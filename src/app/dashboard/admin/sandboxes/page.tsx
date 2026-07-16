import { redirect } from 'next/navigation'
import type { Metadata } from 'next/types'
import { Suspense } from 'react'
import { METADATA } from '@/configs/metadata'
import { AUTH_URLS, PROTECTED_URLS } from '@/configs/urls'
import { getAuthContext } from '@/core/server/auth'
import AllTeamsSandboxes from '@/features/dashboard/admin/all-teams-sandboxes'
import LoadingLayout from '@/features/dashboard/loading-layout'
import { HydrateClient, prefetch, trpc } from '@/trpc/server'

export const metadata: Metadata = {
  title: 'Admin · All teams - E2B',
  description: METADATA.description,
  robots: 'noindex, nofollow',
}

export default async function AdminSandboxesPage() {
  const authContext = await getAuthContext()

  if (!authContext) {
    redirect(AUTH_URLS.SIGN_IN)
  }

  if (!authContext.user.isAdmin) {
    redirect(PROTECTED_URLS.DASHBOARD)
  }

  prefetch(trpc.sandboxes.getAllTeamsSandboxes.queryOptions())

  return (
    <HydrateClient>
      <Suspense fallback={<LoadingLayout />}>
        <AllTeamsSandboxes />
      </Suspense>
    </HydrateClient>
  )
}
