export const ALLOW_SEO_INDEXING = process.env.ALLOW_SEO_INDEXING === '1'
export const VERBOSE = process.env.NEXT_PUBLIC_VERBOSE === '1'
export const INCLUDE_BILLING = false
export const INCLUDE_ARGUS = process.env.NEXT_PUBLIC_INCLUDE_ARGUS === '1'
export const INCLUDE_STATUS_INDICATOR =
  process.env.NEXT_PUBLIC_INCLUDE_STATUS_INDICATOR === '1'
export const USE_MOCK_DATA =
  process.env.VERCEL_ENV !== 'production' &&
  process.env.NEXT_PUBLIC_MOCK_DATA === '1'

export const INCLUDE_DASHBOARD_FEEDBACK_SURVEY =
  process.env.NEXT_PUBLIC_POSTHOG_DASHBOARD_FEEDBACK_SURVEY_ID &&
  process.env.NEXT_PUBLIC_POSTHOG_KEY

export const INCLUDE_REPORT_ISSUE =
  process.env.NEXT_PUBLIC_INCLUDE_REPORT_ISSUE === '1'

// Comma-separated allowlist of admin identifiers (username or email), matched
// against the Kratos session identity to grant the all-teams admin views.
export const ADMIN_USERS = (process.env.ADMIN_USERS ?? '')
  .split(',')
  .map((entry) => entry.trim().toLowerCase())
  .filter(Boolean)

// Comma-separated allowlist of admin user ids (public.users.id / Ory external_id),
// the reliable admin key when SSO email/name are placeholder values.
export const ADMIN_USER_IDS = (process.env.ADMIN_USER_IDS ?? '')
  .split(',')
  .map((entry) => entry.trim().toLowerCase())
  .filter(Boolean)
