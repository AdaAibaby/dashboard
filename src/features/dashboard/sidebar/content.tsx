'use client'

import micromatch from 'micromatch'
import { usePathname } from 'next/navigation'
import { useMemo } from 'react'
import { SIDEBAR_MAIN_LINKS, type SidebarNavItem } from '@/configs/sidebar'
import { PROTECTED_URLS } from '@/configs/urls'

import { useIsMobile } from '@/lib/hooks/use-mobile'
import { cn } from '@/lib/utils'
import { HoverPrefetchLink } from '@/ui/hover-prefetch-link'
import {
  SIDEBAR_TRANSITION_CLASSNAMES,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/ui/primitives/sidebar'
import { useDashboard } from '../context'

type GroupedLinks = {
  [key: string]: SidebarNavItem[]
}

const createGroupedLinks = (links: SidebarNavItem[]): GroupedLinks => {
  return links.reduce((acc, link) => {
    const group = link.group || 'ungrouped'
    if (!acc[group]) {
      acc[group] = []
    }
    acc[group].push(link)
    return acc
  }, {} as GroupedLinks)
}

export default function DashboardSidebarContent() {
  const { team, user } = useDashboard()
  const selectedTeamSlug = team.slug

  const pathname = usePathname()
  const isMobile = useIsMobile()
  const { setOpenMobile } = useSidebar()

  const groupedNavLinks = useMemo(
    () => createGroupedLinks(SIDEBAR_MAIN_LINKS),
    []
  )

  const isActive = (link: SidebarNavItem) => {
    if (!pathname || !link.activeMatch) return false

    return micromatch.isMatch(pathname, link.activeMatch)
  }

  return (
    <SidebarContent className="overflow-x-hidden gap-0">
      {user.isAdmin && (
        <SidebarGroup>
          <SidebarGroupLabel>Admin</SidebarGroupLabel>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={pathname?.startsWith(PROTECTED_URLS.ADMIN_SANDBOXES)}
                asChild
                tooltip="All teams · Sandboxes"
              >
                <HoverPrefetchLink
                  href={PROTECTED_URLS.ADMIN_SANDBOXES}
                  onClick={isMobile ? () => setOpenMobile(false) : undefined}
                >
                  <span>All teams · Sandboxes</span>
                </HoverPrefetchLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
      )}
      {Object.entries(groupedNavLinks).map(([group, links], ix) => (
        <SidebarGroup key={group}>
          {group !== 'ungrouped' && (
            <SidebarGroupLabel>{group}</SidebarGroupLabel>
          )}
          <SidebarMenu>
            {links.map((item) => {
              const href = item.href({
                teamSlug: selectedTeamSlug,
              })

              return (
                <SidebarMenuItem key={item.label}>
                  <SidebarMenuButton
                    isActive={isActive(item)}
                    asChild
                    tooltip={item.label}
                  >
                    <HoverPrefetchLink
                      href={href}
                      onClick={
                        isMobile
                          ? () => {
                              setOpenMobile(false)
                            }
                          : undefined
                      }
                    >
                      <item.icon
                        className={cn(
                          'transition-[size]',
                          SIDEBAR_TRANSITION_CLASSNAMES,
                          isActive(item) && 'text-accent-main-highlight'
                        )}
                      />
                      <span>{item.label}</span>
                    </HoverPrefetchLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )
            })}
          </SidebarMenu>
        </SidebarGroup>
      ))}
    </SidebarContent>
  )
}
