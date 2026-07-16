import Link from 'next/link'
import { buildOryStartURL } from '@/core/server/auth/ory/build-start-url'
import { Button } from '@/ui/primitives/button'

type PageProps = {
  searchParams: Promise<{ returnTo?: string }>
}

export default async function Page({ searchParams }: PageProps) {
  const { returnTo } = await searchParams
  const oauthUrl = buildOryStartURL('signin', returnTo)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-xl font-semibold">登录</h1>
        <p className="text-sm text-fg-secondary">选择登录方式以继续</p>
      </div>

      <Button asChild className="w-full">
        <Link href={oauthUrl}>使用小北账号 SSO 登录</Link>
      </Button>

      <div className="relative flex items-center gap-3">
        <div className="flex-1 border-t border-stroke" />
        <span className="text-xs text-fg-tertiary">或</span>
        <div className="flex-1 border-t border-stroke" />
      </div>

      <Button asChild variant="secondary" className="w-full">
        <Link href={oauthUrl}>使用邮箱和密码登录</Link>
      </Button>
    </div>
  )
}
