import 'server-only'

import { type NextRequest, NextResponse } from 'next/server'
import { signOut } from '@/core/server/auth'
import { clearAppSessionCookies } from '@/core/server/auth/ory/clear-session-cookies'

export async function GET(request: NextRequest) {
  const origin =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ||
    request.nextUrl.origin

  const returnTo = request.nextUrl.searchParams.get('return_to') ?? undefined
  const { redirectTo } = await signOut({ origin, returnTo })

  const response = NextResponse.redirect(new URL(redirectTo, origin))
  clearAppSessionCookies(request, response)
  return response
}
