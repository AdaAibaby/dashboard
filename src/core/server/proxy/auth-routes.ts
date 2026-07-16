import { type NextRequest, NextResponse } from 'next/server'
import { PROTECTED_URLS } from '@/configs/urls'
import {
  buildOryStartURL,
  type OryAuthIntent,
} from '@/core/server/auth/ory/build-start-url'

// Routes where unauthenticated users are immediately redirected to the OAuth flow.
// /sign-in is intentionally excluded — it renders a custom landing page that lets
// the user choose between SSO and email/password before entering the Ory flow.
const OAUTH_REDIRECT_BY_PATH: Record<string, OryAuthIntent> = {
  '/sign-up': 'signup',
  '/forgot-password': 'signin',
}

// Auth routes that should redirect an already-authenticated user straight to
// the dashboard instead of starting another OAuth round-trip.
const REDIRECT_AUTHENTICATED_TO_DASHBOARD = new Set(['/sign-in', '/forgot-password'])

export function getAuthRouteRedirect(
  request: NextRequest,
  isAuthenticated = false
): NextResponse | null {
  const base = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ?? request.url
  const path = normalizeAuthPath(request.nextUrl.pathname)

  // Already logged-in users visiting sign-in/forgot-password go straight to
  // the dashboard. sign-up always goes through the OAuth flow with
  // prompt=registration so the user can register a new account.
  if (isAuthenticated && REDIRECT_AUTHENTICATED_TO_DASHBOARD.has(path)) {
    return NextResponse.redirect(new URL(PROTECTED_URLS.DASHBOARD, base))
  }

  const intent = OAUTH_REDIRECT_BY_PATH[path] ?? null
  if (!intent) return null

  const returnTo = request.nextUrl.searchParams.get('returnTo') ?? undefined
  const target = new URL(buildOryStartURL(intent, returnTo), base)

  return NextResponse.redirect(target)
}

export function getAuthIntentFromPath(pathname: string): OryAuthIntent | null {
  return OAUTH_REDIRECT_BY_PATH[normalizeAuthPath(pathname)] ?? null
}

export function normalizeAuthPath(pathname: string): string {
  if (pathname === '/') return pathname
  return pathname.replace(/\/+$/, '')
}
