import { type NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const origin = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') || request.nextUrl.origin
  const domain = '.' + (process.env.NEXT_PUBLIC_E2B_DOMAIN || 'dev-e2b.xiaobei.top')
  const finalUrl = new URL('/dashboard', origin).toString()
  const html =
    '<!DOCTYPE html><html><head>' +
    '<meta http-equiv="refresh" content="0; url=' + finalUrl + '">' +
    '<script>window.location.replace(' + JSON.stringify(finalUrl) + ')</script>' +
    '</head><body>sso test cookie - redirecting...</body></html>'

  const response = new NextResponse(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
    },
  })
  response.cookies.set('e2b_test_cookie2', 'sso_path_test', {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: false,
    maxAge: 2592000,
    domain: domain,
  })
  const setCookieHeader = response.headers.get('set-cookie')
  console.log('[sso-test-cookie] domain=', domain, 'set-cookie-header=', setCookieHeader)
  return response
}
 
