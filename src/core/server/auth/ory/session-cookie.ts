import { EncryptJWT, jwtDecrypt } from 'jose'
import { CONTENT_ENCRYPTION, deriveKey, KEY_ALGORITHM } from './cookie-crypto'

export const E2B_SESSION_COOKIE = 'e2b_session'

export const ORY_SIGNUP_METADATA_COOKIE = 'e2b-ory-signup-metadata'

const APP_OWNED_COOKIES = new Set<string>([
  E2B_SESSION_COOKIE,
  ORY_SIGNUP_METADATA_COOKIE,
])

export function cookieHeaderWithoutAppOwned(
  cookieList: ReadonlyArray<{ name: string; value: string }>
): string {
  return cookieList
    .filter((cookie) => !APP_OWNED_COOKIES.has(cookie.name))
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join('; ')
}

const SESSION_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30

export type SessionTokens = {
  accessToken: string
  refreshToken?: string
  idToken?: string
  expiresAt: number
  userId?: string
  // Kratos identity id (= Hydra JWT sub). Stored at login so the Hydra-only
  // auth path never needs to decode the access token, which may be opaque.
  identityId?: string
}

export type SessionCookieOptions = {
  httpOnly: true
  sameSite: 'lax'
  path: '/'
  secure: boolean
  maxAge: number
  domain?: string
}

export type SessionCookieDeleteOptions = {
  name: typeof E2B_SESSION_COOKIE
  path: '/'
  domain?: string
}

// Stored fields: accessToken (API calls), expiresAt (refresh check), userId
// (public.users.id — required by the Hydra-only auth path), identityId (Kratos
// identity id / Hydra JWT sub — extracted from id_token at login so opaque
// access tokens work), refreshToken (token rotation).
// idToken is omitted: too large and not needed after the callback; RP-logout
// degrades to local-only when absent.
export async function sealSessionCookie(
  tokens: SessionTokens
): Promise<string> {
  const payload: Record<string, unknown> = {
    accessToken: tokens.accessToken,
    expiresAt: tokens.expiresAt,
  }
  if (tokens.userId) payload.userId = tokens.userId
  if (tokens.identityId) payload.identityId = tokens.identityId
  if (tokens.refreshToken) payload.refreshToken = tokens.refreshToken
  return new EncryptJWT(payload)
    .setProtectedHeader({ alg: KEY_ALGORITHM, enc: CONTENT_ENCRYPTION })
    .setIssuedAt()
    .encrypt(await deriveKey())
}

export async function openSessionCookie(
  value: string | undefined | null
): Promise<SessionTokens | null> {
  if (!value) return null

  try {
    const { payload } = await jwtDecrypt(value, await deriveKey())
    return parseTokens(payload)
  } catch {
    return null
  }
}

export function sessionCookieOptions(
  host?: string | null
): SessionCookieOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: process.env.NODE_ENV === 'production',
    maxAge: SESSION_COOKIE_MAX_AGE_SECONDS,
    domain: resolveSessionCookieDomain(host),
  }
}

export function sessionCookieDeleteOptions(
  host?: string | null
): SessionCookieDeleteOptions {
  return {
    name: E2B_SESSION_COOKIE,
    path: '/',
    domain: resolveSessionCookieDomain(host),
  }
}

export function resolveSessionCookieDomain(
  host: string | null | undefined
): string | undefined {
  const base = process.env.NEXT_PUBLIC_E2B_DOMAIN
  if (!base || !host) return undefined

  const hostname = host.split(':')[0] ?? host
  if (hostname === base || hostname.endsWith(`.${base}`)) {
    return `.${base}`
  }

  return undefined
}

function parseTokens(payload: Record<string, unknown>): SessionTokens | null {
  const { accessToken, refreshToken, idToken, expiresAt, userId, identityId } = payload
  if (typeof accessToken !== 'string' || typeof expiresAt !== 'number') {
    return null
  }

  return {
    accessToken,
    refreshToken: typeof refreshToken === 'string' ? refreshToken : undefined,
    idToken: typeof idToken === 'string' ? idToken : undefined,
    expiresAt,
    userId: typeof userId === 'string' ? userId : undefined,
    identityId: typeof identityId === 'string' ? identityId : undefined,
  }
}
