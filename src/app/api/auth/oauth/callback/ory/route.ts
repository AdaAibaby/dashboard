import 'server-only'

import { type NextRequest, NextResponse } from 'next/server'
import { PROTECTED_URLS } from '@/configs/urls'
import { ensureOryUserBootstrapped } from '@/core/server/auth/ory/dashboard-bootstrap'
import { exchangeOryCallback } from '@/core/server/auth/ory/oauth-client'
import {
  E2B_OAUTH_FLOW_COOKIE,
  ORY_RECOVER_PATH,
  openOryFlowState,
} from '@/core/server/auth/ory/oauth-flow'
import { resolveOryRedirectUri } from '@/core/server/auth/ory/oauth-relay'
import { readKratosExternalId } from '@/core/server/auth/ory/session'
import {
  ORY_SIGNUP_METADATA_COOKIE,
  sealSessionCookie,
} from '@/core/server/auth/ory/session-cookie'
import {
  buildOryLogoutUrl,
  ORY_POST_LOGOUT_PATH,
} from '@/core/server/auth/ory/signout'
import { storePendingJwe } from '@/core/server/auth/ory/pending-tokens'
import { l, serializeErrorForLog } from '@/core/shared/clients/logger/logger'
import { relativeUrlSchema } from '@/core/shared/schemas/url'

export async function GET(request: NextRequest) {
  const origin =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ||
    request.nextUrl.origin

  l.info(
    {
      key: 'oauth_callback:start',
      origin,
      requestUrl: request.url,
      hasSiteUrl: !!process.env.NEXT_PUBLIC_SITE_URL,
    },
    'OAuth callback started'
  )

  const flow = await openOryFlowState(
    request.cookies.get(E2B_OAUTH_FLOW_COOKIE)?.value
  )

  if (!flow) {
    l.warn(
      { key: 'oauth_callback:missing_flow_state' },
      'Ory callback hit without a valid flow-state cookie'
    )
    return finalize(NextResponse.redirect(new URL(ORY_RECOVER_PATH, origin)))
  }

  let tokens: Awaited<ReturnType<typeof exchangeOryCallback>>
  try {
    tokens = await exchangeOryCallback({
      currentUrl: new URL(request.url),
      expectedState: flow.state,
      expectedNonce: flow.nonce,
      codeVerifier: flow.codeVerifier,
      redirectUri: resolveOryRedirectUri(origin).redirectUri,
    })
  } catch (error) {
    l.error(
      {
        key: 'oauth_callback:exchange_failed',
        error: serializeErrorForLog(error),
      },
      'Ory authorization code exchange failed'
    )
    return finalize(NextResponse.redirect(new URL(ORY_RECOVER_PATH, origin)))
  }

  l.info(
    {
      key: 'oauth_callback:tokens_received',
      hasAccessToken: !!tokens.accessToken,
      hasRefreshToken: !!tokens.refreshToken,
      hasIdToken: !!tokens.idToken,
      expiresAt: tokens.expiresAt,
    },
    'OAuth tokens received'
  )

  // readKratosExternalId checks for an active Kratos session. In Hydra-only
  // setups (no Kratos), this always returns null. We log the value for
  // diagnostics but ALWAYS call ensureOryUserBootstrapped so we get a userId
  // regardless — the session cookie validation requires userId (session.ts:89).
  const alreadyProvisioned = await readKratosExternalId()
  l.info({ key: 'oauth_callback:provisioned_check', alreadyProvisioned }, 'Provisioning check')

  const bootstrapResult = await ensureOryUserBootstrapped({
    accessToken: tokens.accessToken,
    idToken: tokens.idToken,
    provider: 'ory',
  })

  if (!bootstrapResult.success) {
    l.error(
      { key: 'oauth_callback:bootstrap_failed' },
      'dashboard bootstrap failed; ending the Ory session without a dashboard cookie'
    )
    const logoutUrl = tokens.idToken
      ? await buildOryLogoutUrl({ idToken: tokens.idToken, origin })
      : null
    return finalize(
      NextResponse.redirect(
        logoutUrl ?? new URL(ORY_POST_LOGOUT_PATH, origin)
      )
    )
  }

  const bootstrapUserId = bootstrapResult.userId
  l.info({ key: 'oauth_callback:bootstrap_success', bootstrapUserId }, 'Bootstrap succeeded')

  const sealed = await sealSessionCookie({
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    idToken: tokens.idToken,
    expiresAt: tokens.expiresAt,
    userId: bootstrapUserId,
  })

  const parsedReturnTo = relativeUrlSchema.safeParse(flow.returnTo)
  const destination = parsedReturnTo.success
    ? parsedReturnTo.data
    : PROTECTED_URLS.DASHBOARD

  const finalUrl = new URL(destination, origin).toString()

  l.info(
    {
      key: 'oauth_callback:urls',
      origin,
      finalUrl,
      sealedLen: sealed.length,
      cookieDomain: new URL(origin).host,
      userId: bootstrapUserId,
    },
    'OAuth callback: storing JWE and redirecting to session-finalize'
  )

  // Store the sealed JWE in a short-lived in-process store and redirect to
  // /api/auth/session-finalize, which reads it and sets the HttpOnly cookie.
  // This avoids putting the large (~3800-byte) JWE in a Set-Cookie header on
  // a navigation response — volcalb CDN rejects such responses with 502.
  const tokenId = storePendingJwe(sealed)
  const finalizeUrl = new URL(
    `/api/auth/session-finalize?t=${tokenId}&next=${encodeURIComponent(destination)}`,
    origin
  )
  return finalize(NextResponse.redirect(finalizeUrl))
}

function finalize(response: NextResponse): NextResponse {
  response.cookies.delete(E2B_OAUTH_FLOW_COOKIE)
  response.cookies.delete(ORY_SIGNUP_METADATA_COOKIE)
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
  return response
}
