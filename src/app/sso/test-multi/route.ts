import { type NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const origin = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') || request.nextUrl.origin
  const domain = '.' + (process.env.NEXT_PUBLIC_E2B_DOMAIN || 'dev-e2b.xiaobei.top')
  const finalUrl = new URL('/dashboard', origin).toString()
  const html =
    '<!DOCTYPE html><html><head>' +
    '<meta http-equiv="refresh" content="0; url=' + finalUrl + '">' +
    '<script>window.location.replace(' + JSON.stringify(finalUrl) + ')</script>' +
    '</head><body>multi cookie test</body></html>'

  const response = new NextResponse(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
    },
  })
  // 模拟 finalize() 的删除操作
  response.cookies.delete('e2b_oauth_flow')
  response.cookies.delete('e2b-ory-signup-metadata')
  // 模拟设置 session cookie
  response.cookies.set('e2b_multi_test', 'multi_test_value', {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: false,
    maxAge: 2592000,
    domain: domain,
  })
  return response
}
 
