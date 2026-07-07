import type { NextRequest } from 'next/server'
import { openSessionCookie, cookieHeaderWithoutAppOwned, E2B_SESSION_COOKIE } from './session-cookie'

// Edge-safe Kratos session check for the middleware gate. getServerSession()
// reads next/headers and can't run in the edge runtime, so we hit Kratos
// directly with the request's cookies. This gates redirects only —
// authoritative enforcement happens server-side in getAuthContext.
//
// external_id is required so this gate agrees with getAuthContext: a session
// without it is half-provisioned and getAuthContext rejects it, so we must too,
// otherwise the user loops between /sign-in and /dashboard.
//
// Fallback: Hydra-only setups (no Kratos) embed userId in the e2b_session
// cookie during bootstrap. If Kratos is absent or returns non-OK, we fall
// back to checking the sealed cookie for a valid userId + unexpired token.
export async function isKratosSessionActive(
  request: NextRequest
): Promise<boolean> {
  const sdkUrl = process.env.NEXT_PUBLIC_ORY_SDK_URL ?? process.env.ORY_SDK_URL
  const cookie = cookieHeaderWithoutAppOwned(request.cookies.getAll())

  if (sdkUrl && cookie) {
    try {
      const response = await fetch(
        `${sdkUrl.replace(/\/$/, '')}/sessions/whoami`,
        { headers: { cookie, accept: 'application/json' } }
      )
      if (response.ok) {
        const session = (await response.json()) as {
          active?: boolean
          identity?: { external_id?: string | null }
        }
        if (session.active === true && !!session.identity?.external_id) {
          return true
        }
      }
    } catch {
      // fall through to cookie fallback
    }
  }

  // Fallback: no Kratos session — check the e2b_session cookie which embeds
  // userId after OAuth bootstrap. A valid userId + non-expired access token
  // means the user is authenticated via the Hydra-only path.
  const sessionCookieValue = request.cookies.get(E2B_SESSION_COOKIE)?.value
  if (!sessionCookieValue) return false

  try {
    const tokens = await openSessionCookie(sessionCookieValue)
    if (!tokens?.userId) return false
    const now = Math.floor(Date.now() / 1000)
    return tokens.expiresAt === 0 || now < tokens.expiresAt
  } catch {
    return false
  }
}
