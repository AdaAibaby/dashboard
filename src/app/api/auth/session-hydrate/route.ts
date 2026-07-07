import 'server-only'

import { jwtDecrypt } from 'jose'
import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import {
  E2B_SESSION_COOKIE,
  openSessionCookie,
  sessionCookieOptions,
} from '@/core/server/auth/ory/session-cookie'
import { deriveKey } from '@/core/server/auth/ory/cookie-crypto'
import { l } from '@/core/shared/clients/logger/logger'

const bodySchema = z.object({
  token: z.string().min(1),
})

export async function POST(request: NextRequest) {
  const origin =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ||
    request.nextUrl.origin

  l.info(
    { key: 'session_hydrate:request', origin, nextUrl: request.nextUrl.toString() },
    'session-hydrate POST received'
  )

  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const parsed = bodySchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  }

  const { token } = parsed.data

  l.info(
    { key: 'session_hydrate:token_received', token_len: token.length, token_prefix: token.slice(0, 40) },
    'session-hydrate: attempting to decrypt token'
  )

  // Attempt decryption directly to capture the exact error message.
  let decryptError: string | undefined
  try {
    await jwtDecrypt(token, await deriveKey())
  } catch (e: unknown) {
    decryptError = e instanceof Error ? `${e.name}: ${e.message}` : String(e)
  }

  const session = await openSessionCookie(token)
  if (!session) {
    l.warn(
      {
        key: 'session_hydrate:invalid_token',
        decrypt_error: decryptError,
        token_len: token.length,
        token_prefix: token.slice(0, 50),
        has_session_secret: !!process.env.E2B_SESSION_SECRET,
      },
      'session-hydrate received a token that could not be decrypted'
    )
    return NextResponse.json({ error: 'invalid_token', detail: decryptError }, { status: 401 })
  }

  l.info(
    {
      key: 'session_hydrate:success',
      userId: session.userId,
      expiresAt: session.expiresAt,
      hasAccessToken: !!session.accessToken,
      cookieDomain: new URL(origin).host,
    },
    'session-hydrate: setting cookie'
  )

  const response = NextResponse.json({ ok: true })
  response.cookies.set(
    E2B_SESSION_COOKIE,
    token,
    sessionCookieOptions(new URL(origin).host)
  )
  return response
}
