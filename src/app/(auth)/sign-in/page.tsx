import Link from 'next/link'
import { buildOryStartURL } from '@/core/server/auth/ory/build-start-url'
import { Button } from '@/ui/primitives/button'
import { XiaobeiLogo } from '@/components/ui/svgs/xiaobei'
import { PasswordLoginForm } from './PasswordLoginForm'

type PageProps = {
  searchParams: Promise<{ returnTo?: string }>
}

export default async function Page({ searchParams }: PageProps) {
  const { returnTo } = await searchParams
  const oauthUrl = buildOryStartURL('signin', returnTo)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-xl font-semibold">Sign in</h1>
        <p className="text-sm text-fg-secondary">Sign in with a social provider or your email.</p>
      </div>

      <Button variant="secondary" className="flex w-full items-center gap-2" asChild>
        <Link href={oauthUrl} prefetch={false} target="_top">
          <XiaobeiLogo className="h-5 w-5" aria-hidden="true" focusable="false" />
          Continue with 小北
        </Link>
      </Button>

      <div className="relative flex items-center gap-3">
        <div className="flex-1 border-t border-stroke" />
        <span className="text-xs text-fg-tertiary">or</span>
        <div className="flex-1 border-t border-stroke" />
      </div>

      <PasswordLoginForm returnTo={returnTo} />
    </div>
  )
}
