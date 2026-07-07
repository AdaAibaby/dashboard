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
  E2B_SESSION_COOKIE,
  ORY_SIGNUP_METADATA_COOKIE,
  sealSessionCookie,
  sessionCookieOptions,
} from '@/core/server/auth/ory/session-cookie'
import {
  buildOryLogoutUrl,
  ORY_POST_LOGOUT_PATH,
} from '@/core/server/auth/ory/signout'
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
      nextUrl: request.nextUrl.toString(),
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

  const alreadyProvisioned = await readKratosExternalId()
  l.info({ key: 'oauth_callback:provisioned_check', alreadyProvisioned }, 'Provisioning check')

  let bootstrapUserId: string | undefined
  if (!alreadyProvisioned) {
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
    bootstrapUserId = bootstrapResult.userId
    l.info({ key: 'oauth_callback:bootstrap_success', bootstrapUserId }, 'Bootstrap succeeded')
  } else {
    l.warn(
      { key: 'oauth_callback:already_provisioned_no_userid' },
      'User already provisioned via Kratos — userId NOT included in cookie (Hydra-only path may fail!)'
    )
  }

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
  const hydrateUrl = new URL('/api/auth/session-hydrate', origin).toString()

  l.info(
    {
      key: 'oauth_callback:urls',
      origin,
      finalUrl,
      hydrateUrl,
      sealedLen: sealed.length,
      cookieDomain: new URL(origin).host,
      userId: bootstrapUserId,
    },
    'OAuth callback: prepared URLs and cookie'
  )

  const finalUrlJson = JSON.stringify(finalUrl)
  const hydrateUrlJson = JSON.stringify(hydrateUrl)
  const sealedJson = JSON.stringify(sealed)

  const html =
    '<!DOCTYPE html><html><head><meta charset="utf-8">' +
    '<style>body{font:13px monospace;background:#111;color:#0f0;padding:16px;}' +
    '#s{white-space:pre-wrap;}</style></head><body>' +
    '<div id="s">STEP1: page loaded</div>' +
    '<script>(function(){' +
    'var el=document.getElementById("s");' +
    'function log(m){el.textContent+="\n"+m;console.log("[callback-debug]",m);}' +
    'var u=' + finalUrlJson + ';' +
    'var h=' + hydrateUrlJson + ';' +
    'var t=' + sealedJson + ';' +
    'log("STEP2: token len="+t.length+" origin="+location.origin);' +
    'log("STEP3: fetch -> "+h);' +
    'log("STEP3b: page_origin="+location.origin+" same_origin="+(location.origin===new URL(h).origin));' +
    'fetch(h,{method:"POST",credentials:"same-origin",' +
    'headers:{"Content-Type":"application/json"},' +
    'body:JSON.stringify({token:t})})' +
    '.then(function(r){log("FETCH_OK status="+r.status);return r.json();})' +
    '.then(function(d){log("FETCH_JSON "+JSON.stringify(d));})' +
    '.catch(function(e){log("FETCH_ERR "+e.message+" (type="+e.name+")");})' +
    '.finally(function(){' +
    'log("STEP4: navigating in 4s -> "+u);' +
    'setTimeout(function(){window.location.replace(u);},4000);' +
    '});' +
    'setTimeout(function(){log("TIMEOUT_8s: navigating now");window.location.replace(u);},8000);' +
    '})()</script></body></html>'

  const response = finalize(
    new NextResponse(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      },
    })
  )
  response.cookies.set(
    E2B_SESSION_COOKIE,
    sealed,
    sessionCookieOptions(new URL(origin).host)
  )
  return response
}

function finalize(response: NextResponse): NextResponse {
  response.cookies.delete(E2B_OAUTH_FLOW_COOKIE)
  response.cookies.delete(ORY_SIGNUP_METADATA_COOKIE)
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
  return response
}
