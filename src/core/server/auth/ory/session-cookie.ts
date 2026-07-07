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

// Only the access token (needed for API calls), expiresAt (for refresh checks),
// and userId (required by session.ts validation) are stored in the cookie.
// refreshToken and idToken are intentionally omitted to keep the cookie under
// ~2 KB — volcalb CDN rejects HTTP responses with Set-Cookie headers > ~3.9 KB.
// The Hydra access token has a ~1-year TTL so seamless refresh is not needed.
// RP-initiated logout degrades to local-only when idToken is absent.
export async function sealSessionCookie(
  tokens: SessionTokens
): Promise<string> {
  const payload: Record<string, unknown> = {
    accessToken: tokens.accessToken,
    expiresAt: tokens.expiresAt,
  }
  if (tokens.userId) payload.userId = tokens.userId
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
  const { accessToken, refreshToken, idToken, expiresAt, userId } = payload
  if (typeof accessToken !== 'string' || typeof expiresAt !== 'number') {
    return null
  }

  return {
    accessToken,
    refreshToken: typeof refreshToken === 'string' ? refreshToken : undefined,
    idToken: typeof idToken === 'string' ? idToken : undefined,
    expiresAt,
    userId: typeof userId === 'string' ? userId : undefined,
  }
}
