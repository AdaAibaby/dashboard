'use client'

import { useSuspenseQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { useMemo, useState } from 'react'
import { PROTECTED_URLS } from '@/configs/urls'
import { sandboxListPollingIntervals } from '@/features/dashboard/sandboxes/list/stores/table-store'
import { useTRPC } from '@/trpc/client'
import { PollingButton } from '@/ui/polling-button'
import { Badge } from '@/ui/primitives/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/ui/primitives/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/ui/primitives/table'

function formatStartedAt(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString()
}

export default function AllTeamsSandboxes() {
  const trpc = useTRPC()

  const { data, refetch, isFetching } = useSuspenseQuery(
    trpc.sandboxes.getAllTeamsSandboxes.queryOptions(undefined, {
      refetchOnMount: 'always',
      refetchOnWindowFocus: true,
    })
  )

  const [pollingInterval, setPollingInterval] = useState(0)

  const sortedPerTeam = useMemo(
    () => [...data.perTeam].sort((a, b) => b.count - a.count),
    [data.perTeam]
  )

  return (
    <div className="flex h-full min-h-0 flex-col gap-6 overflow-y-auto p-3 md:p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="prose-headline-large">All teams · Sandboxes</h1>
          <p className="text-fg-secondary prose-body">
            Aggregated view of every running sandbox across all teams.
          </p>
        </div>
        <PollingButton
          intervals={sandboxListPollingIntervals}
          interval={pollingInterval}
          onIntervalChange={setPollingInterval}
          onRefresh={() => {
            refetch()
          }}
          isRefreshing={isFetching}
        />
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card>
          <CardHeader>
            <CardDescription>Total running sandboxes</CardDescription>
            <CardTitle className="prose-display-small">{data.total}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Teams</CardDescription>
            <CardTitle className="prose-display-small">
              {data.perTeam.length}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Per team</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {sortedPerTeam.map((team) => (
              <Link
                key={team.teamId}
                href={PROTECTED_URLS.SANDBOXES_LIST(team.teamSlug)}
                className="hover:bg-bg-hover flex items-center gap-2 rounded-md border px-3 py-1.5"
              >
                <span className="prose-label">{team.teamName}</span>
                <Badge>{team.count}</Badge>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Team</TableHead>
            <TableHead>Sandbox ID</TableHead>
            <TableHead>Template</TableHead>
            <TableHead>State</TableHead>
            <TableHead>Started</TableHead>
            <TableHead className="text-right">vCPU</TableHead>
            <TableHead className="text-right">RAM (MB)</TableHead>
            <TableHead className="text-right">Disk (MB)</TableHead>
            <TableHead>
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.sandboxes.map((sandbox) => (
            <TableRow key={`${sandbox.teamId}:${sandbox.sandboxID}`}>
              <TableCell>{sandbox.teamName}</TableCell>
              <TableCell className="font-mono">{sandbox.sandboxID}</TableCell>
              <TableCell>{sandbox.alias ?? sandbox.templateID}</TableCell>
              <TableCell>
                <Badge>{sandbox.state}</Badge>
              </TableCell>
              <TableCell>{formatStartedAt(sandbox.startedAt)}</TableCell>
              <TableCell className="text-right">{sandbox.cpuCount}</TableCell>
              <TableCell className="text-right">{sandbox.memoryMB}</TableCell>
              <TableCell className="text-right">{sandbox.diskSizeMB}</TableCell>
              <TableCell className="text-right">
                <Link
                  href={PROTECTED_URLS.SANDBOX(sandbox.teamSlug, sandbox.sandboxID)}
                  className="text-accent-main-highlight hover:underline"
                >
                  Manage
                </Link>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
