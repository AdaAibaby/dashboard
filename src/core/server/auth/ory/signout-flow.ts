import 'server-only'

import { BASE_URL } from '@/configs/urls'
import { normalizeOryReturnTo } from './build-start-url'
import { ORY_POST_LOGOUT_PATH } from './signout'

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

  // revokeCurrentSession() (called by signOut before this) already revoked
  // both the OAuth2 tokens and the Kratos session. The Hydra RP-initiated
  // logout endpoint (/oauth2/sessions/logout) is unavailable in this env
  // (returns 404), so we skip that round-trip and redirect home directly.
  // The sign-in flow uses prompt=login, so Hydra SSO session state does
  // not affect credential re-entry.
  return home
}
