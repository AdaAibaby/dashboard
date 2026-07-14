import { type NextRequest, NextResponse } from "next/server"
import { TAB_URL_MAP } from "@/configs/dashboard-tab-url-map"
import { PROTECTED_URLS } from "@/configs/urls"
import { getAuthContext, signOut } from "@/core/server/auth"
import { resolveUserTeam, TeamApiError } from "@/core/server/functions/team/resolve-user-team"
import { l } from "@/core/shared/clients/logger/logger"
import { setTeamCookies } from "@/lib/utils/cookies"

function getTabRedirectPath(tab: string | null, teamSlug: string) {
  if (tab && Object.hasOwn(TAB_URL_MAP, tab)) {
    const urlGenerator = TAB_URL_MAP[tab]
    if (urlGenerator) {
      return urlGenerator(teamSlug)
    }
  }
  return PROTECTED_URLS.SANDBOXES(teamSlug)
}

export async function GET(request: NextRequest) {
  const origin = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') || request.nextUrl.origin

  l.info(
    { key: 'dashboard:request', origin, url: request.url },
    'Dashboard route: start'
  )

  const searchParams = request.nextUrl.searchParams
  const tab = searchParams.get("tab")

  const authContext = await getAuthContext()

  if (!authContext) {
    l.warn(
      { key: 'dashboard:no_auth_context', origin },
      'Dashboard: no auth context, redirecting to sign-in'
    )
    return NextResponse.redirect(new URL("/sign-in", origin))
  }

  l.info(
    {
      key: 'dashboard:auth_ok',
      userId: authContext.user.id,
      identityId: authContext.user.identityId,
      hasAccessToken: !!authContext.accessToken,
    },
    'Dashboard: auth context ok'
  )

  let team
  try {
    team = await resolveUserTeam(
      authContext.user.id,
      authContext.accessToken
    )
  } catch (error) {
    if (error instanceof TeamApiError) {
      l.error(
        { key: 'dashboard:teams_api_error', user_id: authContext.user.id },
        'Teams API error on dashboard route, returning 503'
      )
      return new NextResponse('Service temporarily unavailable. Please try again.', { status: 503 })
    }
    throw error
  }

  if (!team) {
    l.warn(
      {
        key: "dashboard:no_personal_team",
        user_id: authContext.user.id,
      },
      "no personal team for user, signing out"
    )

    const { redirectTo } = await signOut({ origin })

    return NextResponse.redirect(new URL(redirectTo, origin))
  }

  l.info(
    { key: 'dashboard:team_ok', teamId: team.id, teamSlug: team.slug },
    'Dashboard: team resolved'
  )

  await setTeamCookies(team.id, team.slug)

  const redirectPath = getTabRedirectPath(tab, team.slug)
  const redirectUrl = new URL(redirectPath, origin)

  if (searchParams.get("support") === "true") {
    redirectUrl.searchParams.set("support", "true")
  }

  if (tab === "terminal") {
    const terminalParams = ["template", "sandboxId", "command"]
    terminalParams.forEach((param) => {
      const value = searchParams.get(param)
      if (value) {
        redirectUrl.searchParams.set(param, value)
      }
    })
  }

  return NextResponse.redirect(redirectUrl)
}
