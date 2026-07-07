import 'server-only'

import { type NextRequest, NextResponse } from 'next/server'
import { PROTECTED_URLS } from '@/configs/urls'
import { consumePendingJwe } from '@/core/server/auth/ory/pending-tokens'
import {
  E2B_SESSION_COOKIE,
  openSessionCookie,
  sessionCookieOptions,
} from '@/core/server/auth/ory/session-cookie'
import { l } from '@/core/shared/clients/logger/logger'
import { relativeUrlSchema } from '@/core/shared/schemas/url'

// Consumes a single-use pending JWE token (stored in pending-tokens.ts),
// sets the e2b_session HttpOnly cookie, and redirects to the dashboard.
//
// This route exists because volcalb CDN rejects navigation responses
// (200/307) that carry large Set-Cookie headers (~3800-byte JWE) with 502.
// The OAuth callback stores the JWE in-process and redirects here; this
// handler is the first in the redirect chain that sets the session cookie,
// keeping the cookie-setting response small and CDN-safe.
export async function GET(request: NextRequest) {
  const origin =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ||
    request.nextUrl.origin

  const t = request.nextUrl.searchParams.get('t')
  const nextParam = request.nextUrl.searchParams.get('next') ?? PROTECTED_URLS.DASHBOARD

  if (!t) {
    l.warn({ key: 'session_finalize:missing_token' }, 'finalize called without t param')
    return NextResponse.redirect(new URL('/sign-in', origin))
  }

  const jwe = consumePendingJwe(t)
  if (!jwe) {
    l.warn({ key: 'session_finalize:token_not_found', t }, 'finalize token not found or expired')
    return NextResponse.redirect(new URL('/sign-in', origin))
  }

  // Validate the JWE can actually be decrypted before setting the cookie.
  const session = await openSessionCookie(jwe)
  if (!session) {
    l.error({ key: 'session_finalize:invalid_jwe' }, 'JWE from pending store could not be decrypted')
    return NextResponse.redirect(new URL('/sign-in', origin))
  }

  const destination = relativeUrlSchema.safeParse(nextParam).success
    ? nextParam
    : PROTECTED_URLS.DASHBOARD

  l.info(
    { key: 'session_finalize:success', sealedLen: jwe.length, destination, userId: session.userId },
    'Session cookie set, redirecting to dashboard'
  )

  const response = NextResponse.redirect(new URL(destination, origin))
  response.cookies.set(
    E2B_SESSION_COOKIE,
    jwe,
    sessionCookieOptions(new URL(origin).host)
  )
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
  return response
}
