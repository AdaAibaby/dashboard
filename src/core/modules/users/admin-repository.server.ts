import 'server-only'

import { ADMIN_AUTH_HEADERS } from '@/configs/api'
import { api } from '@/core/shared/clients/api'
import type { components as DashboardApiComponents } from '@/core/shared/contracts/dashboard-api.types'
import { repoErrorFromHttp } from '@/core/shared/errors'
import { err, ok, type RepoResult } from '@/core/shared/result'

export type AdminAuthProviderUserBootstrapRequest =
  DashboardApiComponents['schemas']['AdminAuthProviderUserBootstrapRequest']

type BootstrapResult = {
  teamId: string
  teamSlug: string
  userId?: string
}

type AdminUsersRepositoryDeps = {
  apiClient: typeof api
  adminHeaders: typeof ADMIN_AUTH_HEADERS
  adminToken?: string
}

export interface AdminUsersRepository {
  bootstrapAuthProviderUser(
    body: AdminAuthProviderUserBootstrapRequest
  ): Promise<RepoResult<BootstrapResult>>
}

export function createAdminUsersRepository(
  deps: AdminUsersRepositoryDeps = {
    apiClient: api,
    adminHeaders: ADMIN_AUTH_HEADERS,
    adminToken: process.env.DASHBOARD_API_ADMIN_TOKEN,
  }
): AdminUsersRepository {
  return {
    async bootstrapAuthProviderUser(body) {
      if (!deps.adminToken) {
        return err(
          repoErrorFromHttp(
            500,
            'DASHBOARD_API_ADMIN_TOKEN is not configured',
            new Error('DASHBOARD_API_ADMIN_TOKEN is not configured')
          )
        )
      }

      const dashboardApiUrl =
        process.env.NEXT_PUBLIC_DASHBOARD_API_URL ??
        `https://dashboard-api.${process.env.NEXT_PUBLIC_E2B_DOMAIN}`
      const rawResponse = await fetch(
        `${dashboardApiUrl}/admin/users/bootstrap`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...deps.adminHeaders(deps.adminToken),
          },
          body: JSON.stringify(body),
          cache: 'no-store',
        }
      )

      if (!rawResponse.ok) {
        const errorBody: { message?: string } | null = await rawResponse
          .json()
          .catch(() => null)
        return err(
          repoErrorFromHttp(
            rawResponse.status,
            errorBody?.message ?? 'Failed to bootstrap user',
            errorBody
          )
        )
      }

      const data: { id: string; slug: string; user_id?: string } =
        await rawResponse.json()
      return ok({
        teamId: data.id,
        teamSlug: data.slug,
        userId: data.user_id,
      })
    },
  }
}
