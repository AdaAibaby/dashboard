import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { AUTH_URLS } from '@/configs/urls'
import { l } from '@/core/shared/clients/logger/logger'

const RECOVERY_COOKIE = 'auth_recover_attempted'
const RECOVERY_COOKIE_MAX_AGE_SECONDS = 30

export async function GET(request: NextRequest) {
  const errorCode = request.nextUrl.searchParams.get('error') ?? 'unknown'
  const alreadyAttempted = request.cookies.get(RECOVERY_COOKIE)?.value === '1'

  l.error(
    {
      key: 'oauth_recover:flow_failed',
      context: { error_code: errorCode, already_attempted: alreadyAttempted },
    },
    'OAuth flow failed; recovering user once before bailing to home'
  )

  // Use NEXT_PUBLIC_SITE_URL as base; request.url is the internal container
  // address (https://localhost:3000) which is unreachable from the browser.
  const base = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ?? request.nextUrl.origin
  const destination = alreadyAttempted ? '/' : AUTH_URLS.SIGN_IN
  const response = NextResponse.redirect(new URL(destination, base))

  if (alreadyAttempted) {
    response.cookies.delete(RECOVERY_COOKIE)
  } else {
    response.cookies.set(RECOVERY_COOKIE, '1', {
      maxAge: RECOVERY_COOKIE_MAX_AGE_SECONDS,
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      secure: process.env.NODE_ENV === 'production',
    })
  }

  return response
}
