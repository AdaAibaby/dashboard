import 'server-only'

import type { NextRequest, NextResponse } from 'next/server'
import {
  resolveSessionCookieDomain,
  sessionCookieDeleteOptions,
} from './session-cookie'

const ORY_IDENTITY_SESSION_COOKIE = /^ory_(kratos_)?session/

// Resolves the public-facing host from NEXT_PUBLIC_SITE_URL so cookie deletion
// uses the same domain scope that was used when setting the cookie. Inside
// Docker the request host is localhost:3000, which doesn't match the domain
// attribute (.dev-e2b.xiaobei.top) and would silently fail to clear the cookie.
function resolvePublicHost(request: NextRequest): string {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
  if (siteUrl) {
    try {
      return new URL(siteUrl).host
    } catch {
      // fall through
    }
  }
  return request.nextUrl.host
}

export function clearAppSessionCookies(
  request: NextRequest,
  response: NextResponse
): void {
  const host = resolvePublicHost(request)

  response.cookies.delete(sessionCookieDeleteOptions(host))

  const domain = resolveSessionCookieDomain(host)
  for (const { name } of request.cookies.getAll()) {
    if (!ORY_IDENTITY_SESSION_COOKIE.test(name)) continue
    response.cookies.delete(
      domain ? { name, path: '/', domain } : { name, path: '/' }
    )
  }
}
