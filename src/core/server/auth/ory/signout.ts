import {
  OAUTH_LOGOUT_RELAY_PATH,
  readRelayOrigin,
  sealRelayState,
} from './oauth-relay'

export const ORY_POST_LOGOUT_PATH = '/'

// Builds Hydra's RP-initiated logout URL.
// `idToken` is optional: when present, Hydra uses it to identify and end the
// OAuth2 session. When absent (idToken not stored in the JWE cookie), Hydra
// falls back to the browser's own Hydra session cookie — the session still
// ends; the browser is redirected to post_logout_redirect_uri afterward.
export async function buildOryLogoutUrl({
  idToken,
  origin,
}: {
  idToken?: string
  origin: string
}): Promise<URL | null> {
  const issuer = process.env.ORY_HYDRA_PUBLIC_URL ?? process.env.ORY_SDK_URL
  if (!issuer) return null

  // Previews can't register their dynamic host as a post_logout_redirect_uri,
  // so route through the fixed relay host and carry the real origin in `state`
  // (Hydra returns it to the post-logout URI). See oauth-relay.ts.
  const relay = readRelayOrigin()
  let postLogoutUrl: URL
  let relayState: string | undefined
  if (relay && relay !== origin) {
    postLogoutUrl = new URL(OAUTH_LOGOUT_RELAY_PATH, relay)
    relayState = await sealRelayState(origin)
  } else {
    postLogoutUrl = new URL(ORY_POST_LOGOUT_PATH, origin)
  }

  const logoutUrl = new URL(
    `${issuer.replace(/\/$/, '')}/oauth2/sessions/logout`
  )
  if (idToken) {
    logoutUrl.searchParams.set('id_token_hint', idToken)
  }
  logoutUrl.searchParams.set(
    'post_logout_redirect_uri',
    postLogoutUrl.toString()
  )
  if (relayState) logoutUrl.searchParams.set('state', relayState)

  return logoutUrl
}
