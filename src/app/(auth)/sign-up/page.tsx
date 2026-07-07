import { redirect } from 'next/navigation'
import { buildOryStartURL } from '@/core/server/auth/ory/build-start-url'

type PageProps = {
  searchParams: Promise<{ returnTo?: string }>
}

export default async function Page({ searchParams }: PageProps) {
  const { returnTo } = await searchParams
  const base = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ?? ''
  redirect(base + buildOryStartURL('signup', returnTo))
}
