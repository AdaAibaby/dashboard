import { relativeUrlSchema } from '@/core/shared/schemas/url'

export type OryAuthIntent = 'signin' | 'signup' | 'reauth'

export type OryAuthorizationParams =
  | { prompt: 'registration' | 'login' | 'login registration' }
  | undefined

const ORY_START_PATH = '/api/auth/oauth/start'

export function normalizeOryReturnTo(
  returnTo?: string | null
): string | undefined {
  const parsedReturnTo = relativeUrlSchema.safeParse(returnTo)
  return parsedReturnTo.success ? parsedReturnTo.data : undefined
}

export function buildOryStartURL(
  intent: OryAuthIntent,
  returnTo?: string
): string {
  const params = new URLSearchParams({ intent })
  const safeReturnTo = normalizeOryReturnTo(returnTo)
  if (safeReturnTo) {
    params.set('returnTo', safeReturnTo)
  }
  return `${ORY_START_PATH}?${params}`
}

export function readOryAuthIntent(value: string | null): OryAuthIntent | null {
  if (value === null) return 'signin'
  if (value === 'signin' || value === 'signup' || value === 'reauth') {
    return value
  }
  return null
}

export function authorizationParamsForOryIntent(
  intent: OryAuthIntent
): OryAuthorizationParams {
  if (intent === 'signup') return { prompt: 'login registration' }
  // 'signin' and 'reauth' both force Hydra to show the login form, ensuring a
  // cleared Hydra session (from logout) is not silently resumed.
  return { prompt: 'login' }
}

export function shouldCaptureOrySignupMetadata(intent: OryAuthIntent): boolean {
  return intent === 'signup'
}
