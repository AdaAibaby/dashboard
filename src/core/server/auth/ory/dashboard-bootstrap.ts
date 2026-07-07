import 'server-only'

import { createAdminUsersRepository } from '@/core/modules/users/admin-repository.server'
import { l, serializeErrorForLog } from '@/core/shared/clients/logger/logger'
import type { components as DashboardApiComponents } from '@/core/shared/contracts/dashboard-api.types'
import { decodeJwtClaims, readStringClaim, tokenFormat } from './jwt-claims'
import { readOrySignupMetadataCookie } from './signup-metadata'

type BootstrapOryUserInput = {
  accessToken: string
  idToken?: string
  provider?: string
}

type OryBootstrapClaims = {
  oidcIssuer: string
  oidcUserId: string
  oidcUserEmail: string
  oidcUserName: string | null
}

type OryTokenClaims = {
  iss?: unknown
  sub?: unknown
  email?: unknown
  name?: unknown
  given_name?: unknown
  preferred_username?: unknown
}

export async function ensureOryUserBootstrapped(
  input: BootstrapOryUserInput
): Promise<{ success: boolean; userId?: string }> {
  const body = await createOryUserBootstrapRequest(input)
  if (!body) return { success: false }

  return bootstrapOryUserWithRequest(body, input.provider)
}

export async function createOryUserBootstrapRequest(
  input: BootstrapOryUserInput
): Promise<
  | DashboardApiComponents['schemas']['AdminAuthProviderUserBootstrapRequest']
  | null
> {
  const claims = await resolveBootstrapClaims(input)
  if (!claims) return null

  const signupMetadata = await readOrySignupMetadataCookie()

  return {
    oidc_issuer: claims.oidcIssuer,
    oidc_user_id: claims.oidcUserId,
    oidc_user_email: claims.oidcUserEmail,
    oidc_user_name: claims.oidcUserName,
    ...(signupMetadata?.signup_ip
      ? { signup_ip: signupMetadata.signup_ip }
      : {}),
    ...(signupMetadata?.signup_user_agent
      ? { signup_user_agent: signupMetadata.signup_user_agent }
      : {}),
  } satisfies DashboardApiComponents['schemas']['AdminAuthProviderUserBootstrapRequest']
}

// Email resolution order:
//   1. id_token / access_token claims (fastest)
//   2. OIDC userinfo endpoint (when Hydra claim mapper omits email from tokens)
//   3. Synthetic sub@issuer-host (stable unique identifier — avoids blocking login
//      when Hydra is not configured to surface email)
async function resolveBootstrapClaims(
  input: BootstrapOryUserInput
): Promise<OryBootstrapClaims | null> {
  const idClaims = input.idToken
    ? decodeJwtClaims<OryTokenClaims>(input.idToken)
    : null
  const accessClaims = decodeJwtClaims<OryTokenClaims>(input.accessToken)

  const oidcIssuer =
    readStringClaim(idClaims, 'iss') ?? readStringClaim(accessClaims, 'iss')
  const oidcUserId =
    readStringClaim(accessClaims, 'sub') ?? readStringClaim(idClaims, 'sub')
  const oidcUserName =
    readDisplayName(idClaims) ?? readDisplayName(accessClaims)

  if (!oidcIssuer || !oidcUserId) {
    l.error(
      {
        key: 'auth_events:bootstrap_user:missing_claims',
        context: {
          provider: input.provider,
          access_token_format: tokenFormat(input.accessToken),
          id_token_format: input.idToken ? tokenFormat(input.idToken) : 'missing',
          has_iss: !!oidcIssuer,
          has_sub: !!oidcUserId,
        },
      },
      'Ory token is missing required iss/sub claims'
    )
    return null
  }

  // 1. Try token claims
  let oidcUserEmail =
    readStringClaim(idClaims, 'email') ?? readStringClaim(accessClaims, 'email')

  // 2. Fall back to userinfo endpoint
  if (!oidcUserEmail) {
    oidcUserEmail = await fetchEmailFromUserinfo(input.accessToken, oidcIssuer)
    if (oidcUserEmail) {
      l.info(
        { key: 'auth_events:bootstrap_user:email_from_userinfo' },
        'email resolved from userinfo endpoint'
      )
    }
  }

  // 3. Synthetic identifier when Hydra claim mapper is not configured
  if (!oidcUserEmail) {
    try {
      const issuerHost = new URL(oidcIssuer).hostname
      oidcUserEmail = `${oidcUserId}@${issuerHost}`
      l.warn(
        {
          key: 'auth_events:bootstrap_user:synthetic_email',
          context: { provider: input.provider, synthetic_email: oidcUserEmail },
        },
        'email not in tokens or userinfo; using synthetic identifier — configure Hydra claim mapper to expose email'
      )
    } catch {
      l.error(
        {
          key: 'auth_events:bootstrap_user:missing_claims',
          context: { provider: input.provider },
        },
        'email missing and issuer URL is invalid; cannot construct synthetic email'
      )
      return null
    }
  }

  return { oidcIssuer, oidcUserId, oidcUserEmail, oidcUserName }
}

// Calls the OIDC userinfo endpoint to get email when absent from the tokens.
// Returns null on any error so the caller can fall back gracefully.
async function fetchEmailFromUserinfo(
  accessToken: string,
  issuer: string
): Promise<string | null> {
  try {
    const userinfoUrl = new URL('/userinfo', issuer).toString()
    const res = await fetch(userinfoUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) return null
    const data = await res.json()
    return typeof data.email === 'string' && data.email ? data.email : null
  } catch {
    return null
  }
}

async function bootstrapOryUserWithRequest(
  body: DashboardApiComponents['schemas']['AdminAuthProviderUserBootstrapRequest'],
  provider?: string
): Promise<{ success: boolean; userId?: string }> {
  try {
    const bootstrapResult =
      await createAdminUsersRepository().bootstrapAuthProviderUser(body)

    if (!bootstrapResult.ok) {
      l.error(
        {
          key: 'auth_events:bootstrap_user:error',
          context: {
            provider,
            has_oidc_issuer: body.oidc_issuer !== '',
            has_oidc_user_id: body.oidc_user_id !== '',
            has_oidc_user_email: body.oidc_user_email !== '',
            has_oidc_user_name: body.oidc_user_name !== null,
          },
        },
        `bootstrap_user failed: ${bootstrapResult.error.message}`
      )
      return { success: false }
    }

    return { success: true, userId: bootstrapResult.data.userId }
  } catch (error) {
    l.error(
      {
        key: 'auth_events:bootstrap_user:exception',
        context: { provider },
        error: serializeErrorForLog(error),
      },
      'bootstrap_user threw unexpected exception'
    )
    return { success: false }
  }
}

function readDisplayName(claims: OryTokenClaims | null): string | null {
  return (
    readStringClaim(claims, 'name') ??
    readStringClaim(claims, 'given_name') ??
    readStringClaim(claims, 'preferred_username')
  )
}
