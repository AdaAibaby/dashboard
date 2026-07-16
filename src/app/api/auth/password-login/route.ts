import 'server-only'

import { SignJWT } from 'jose'
import { type NextRequest, NextResponse } from 'next/server'
import { storePendingJwe } from '@/core/server/auth/ory/pending-tokens'
import {
  sealSessionCookie,
} from '@/core/server/auth/ory/session-cookie'
import { PROTECTED_URLS } from '@/configs/urls'

function getSecret(): Uint8Array {
  const secret = process.env.CUSTOM_JWT_SECRET
  if (!secret) throw new Error('CUSTOM_JWT_SECRET is not configured')
  return new TextEncoder().encode(secret)
}

export async function POST(request: NextRequest) {
  const origin =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ||
    request.nextUrl.origin

  let body: { email?: string; password?: string; returnTo?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ message: 'Invalid request body' }, { status: 400 })
  }

  const email = (body.email ?? '').trim().toLowerCase()
  const password = body.password ?? ''
  const returnTo = body.returnTo ?? PROTECTED_URLS.DASHBOARD

  if (!email || !password) {
    return NextResponse.json({ message: '邮箱和密码不能为空' }, { status: 400 })
  }

  const dashboardApiUrl = process.env.NEXT_PUBLIC_DASHBOARD_API_URL ?? 'http://localhost:3010'
  const adminToken = process.env.DASHBOARD_API_ADMIN_TOKEN ?? ''

  // Validate password against PG via dashboard-api internal endpoint
  let validateRes: Response
  try {
    validateRes = await fetch(`${dashboardApiUrl}/internal/auth/validate-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Token': adminToken,
      },
      body: JSON.stringify({ email, password }),
      cache: 'no-store',
    })
  } catch {
    return NextResponse.json({ message: '认证服务暂时不可用' }, { status: 503 })
  }

  if (!validateRes.ok) {
    if (validateRes.status === 401) {
      return NextResponse.json({ message: '邮箱或密码错误' }, { status: 401 })
    }
    return NextResponse.json({ message: '认证失败，请稍后重试' }, { status: 502 })
  }

  const { user_id: userId } = await validateRes.json() as { user_id: string; email: string }

  // Sign HMAC JWT (HS256) — verified by dashboard-api's HMAC strategy
  const issuer = process.env.CUSTOM_JWT_ISSUER ?? 'e2b-dashboard'
  const audience = process.env.ORY_OAUTH2_AUDIENCE ?? 'e2b-sh-dev'
  const expiresAt = Math.floor(Date.now() / 1000) + 24 * 60 * 60  // 24h

  let accessToken: string
  try {
    accessToken = await new SignJWT({ email })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setIssuer(issuer)
      .setAudience(audience)
      .setSubject(userId)
      .setExpirationTime(expiresAt)
      .sign(getSecret())
  } catch {
    return NextResponse.json({ message: '会话创建失败' }, { status: 500 })
  }

  // Seal e2b_session JWE
  const sealed = await sealSessionCookie({
    accessToken,
    expiresAt: expiresAt * 1000,
    userId,
  })

  // Use pending-token approach (CDN-safe: avoids large Set-Cookie on navigation)
  const tokenId = storePendingJwe(sealed)
  const finalizeUrl = new URL('/api/auth/session-finalize', origin)
  finalizeUrl.searchParams.set('t', tokenId)
  finalizeUrl.searchParams.set('next', returnTo)

  return NextResponse.json({ redirect: finalizeUrl.pathname + finalizeUrl.search })
}
