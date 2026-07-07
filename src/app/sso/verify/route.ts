import { type NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const domain = '.' + (process.env.NEXT_PUBLIC_E2B_DOMAIN || 'dev-e2b.xiaobei.top')
  // Non-HttpOnly cookie — visible in document.cookie so user can verify browser sets it
  const html = `<!DOCTYPE html><html><head>
<meta charset="utf-8">
<title>Cookie Verify</title>
</head><body>
<h2>Cookie Set Test</h2>
<div id="result">Checking...</div>
<script>
  var allCookies = document.cookie;
  var match = document.cookie.match(/e2b_verify_test=([^;]+)/);
  var result = document.getElementById('result');
  if (match) {
    result.innerHTML = '<b style="color:green">COOKIE WAS SET: ' + match[1] + '</b><br>All cookies: ' + allCookies;
  } else {
    result.innerHTML = '<b style="color:red">COOKIE NOT SET</b><br>All cookies visible: ' + (allCookies || '(none)');
  }
</script>
</body></html>`

  const response = new NextResponse(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
    },
  })
  // Non-HttpOnly so browser JS can verify it was set
  response.cookies.set('e2b_verify_test', 'COOKIE_SET_OK_' + String(Date.now()).slice(-6), {
    httpOnly: false,
    sameSite: 'lax',
    path: '/',
    secure: false,
    maxAge: 120,
    domain: domain,
  })
  return response
}
 
