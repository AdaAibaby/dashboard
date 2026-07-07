import { type NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const origin = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') || request.nextUrl.origin
  const domain = '.' + (process.env.NEXT_PUBLIC_E2B_DOMAIN || 'dev-e2b.xiaobei.top')
  // 模拟真实 JWE 大小：约 1500-2500 字节的 base64 字符串
  const largeValue = 'eyJhbGciOiJkaXIiLCJlbmMiOiJBMjU2R0NNIn0..'.padEnd(2000, 'A')
  const finalUrl = new URL('/dashboard', origin).toString()
  const html =
    '<!DOCTYPE html><html><head>' +
    '<meta http-equiv="refresh" content="0; url=' + finalUrl + '">' +
    '<script>window.location.replace(' + JSON.stringify(finalUrl) + ')</script>' +
    '</head><body>large cookie test</body></html>'

  const response = new NextResponse(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
    },
  })
  response.cookies.delete('e2b_oauth_flow')
  response.cookies.delete('e2b-ory-signup-metadata')
  response.cookies.set('e2b_session_large', largeValue, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: false,
    maxAge: 2592000,
    domain: domain,
  })
  const setCookieHeader = response.headers.get('set-cookie')
  console.log('[sso-test-large] cookie-size=', largeValue.length, 'header-size=', setCookieHeader?.length)
  return response
}
 
