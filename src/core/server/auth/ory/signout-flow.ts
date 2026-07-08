import 'server-only'

import { cookies } from 'next/headers'
import { BASE_URL } from '@/configs/urls'
import { l, serializeErrorForLog } from '@/core/shared/clients/logger/logger'
import { normalizeOryReturnTo } from './build-start-url'
import { E2B_SESSION_COOKIE, openSessionCookie } from './session-cookie'
import { buildOryLogoutUrl, ORY_POST_LOGOUT_PATH } from './signout'

// Resolves the post-logout landing for the sign-out route.
//
// An explicit internal `returnTo` (reauth, /settings sign-out, etc.) is
// honored directly — no Hydra round-trip needed.
//
// For the default full sign-out, we include the id_token_hint when available
// so Hydra can end its OAuth2 session. When idToken is absent (not stored in
// the JWE cookie in Hydra-only deployments where the admin API is unreachable),
// we fall back to redirecting directly to home. The sign-in flow uses
// `prompt=login` to force credential re-entry regardless of Hydra session state.
export async function completeOrySignOut(
  origin = BASE_URL,
  returnTo?: string
): Promise<string> {
  const target = normalizeOryReturnTo(returnTo)
  if (target) return new URL(target, origin).toString()

  const home = new URL(ORY_POST_LOGOUT_PATH, origin).toString()

  let idToken: string | undefined
  try {
    const cookieStore = await cookies()
    const tokens = await openSessionCookie(
      cookieStore.get(E2B_SESSION_COOKIE)?.value
    )
    idToken = tokens?.idToken
  } catch (error) {
    l.warn(
      {
        key: 'oauth_signout:read_session:error',
        error: serializeErrorForLog(error),
      },
      'failed to read e2b_session before sign-out'
    )
  }

  if (!idToken) return home

  const logoutUrl = await buildOryLogoutUrl({ idToken, origin })
  return logoutUrl?.toString() ?? home
}
