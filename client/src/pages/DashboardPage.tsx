import axios from 'axios'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { TicketsByDayChart } from '@/components/TicketsByDayChart'

type TicketStats = {
  totalTickets: number
  openTickets: number
  resolvedByAiCount: number
  resolvedByAiPercent: number
  avgResolutionTimeMs: number | null
  ticketsByDay: { date: string; count: number }[]
}

async function fetchTicketStats(): Promise<TicketStats> {
  const res = await axios.get<TicketStats>('/api/tickets/stats')
  return res.data
}

function formatDuration(ms: number | null): string {
  if (ms === null) return '—'
  const hours = ms / (60 * 60 * 1000)
  if (hours < 24) {
    const wholeHours = Math.floor(hours)
    const minutes = Math.round((hours - wholeHours) * 60)
    return `${wholeHours}h ${minutes}m`
  }
  const days = Math.floor(hours / 24)
  const remainingHours = Math.round(hours - days * 24)
  return `${days}d ${remainingHours}h`
}

const STAT_TILES: {
  key: keyof TicketStats
  label: string
  format: (stats: TicketStats) => string
}[] = [
  { key: 'totalTickets', label: 'Total Tickets', format: (s) => s.totalTickets.toString() },
  { key: 'openTickets', label: 'Open Tickets', format: (s) => s.openTickets.toString() },
  { key: 'resolvedByAiCount', label: 'Resolved by AI', format: (s) => s.resolvedByAiCount.toString() },
  { key: 'resolvedByAiPercent', label: '% Resolved by AI', format: (s) => `${s.resolvedByAiPercent.toFixed(1)}%` },
  { key: 'avgResolutionTimeMs', label: 'Avg Resolution Time', format: (s) => formatDuration(s.avgResolutionTimeMs) },
]

export default function DashboardPage() {
  const { data: stats, isPending, error } = useQuery({
    queryKey: ['ticket-stats'],
    queryFn: fetchTicketStats,
  })

  if (isPending) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {STAT_TILES.map((tile) => (
            <Card key={tile.key}>
              <CardHeader>
                <CardDescription>{tile.label}</CardDescription>
              </CardHeader>
              <CardContent>
                <Skeleton className="h-9 w-20" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">Tickets per day (last 30 days)</CardTitle>
          </CardHeader>
          <CardContent>
            <Skeleton className="h-[280px] w-full" />
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-destructive">
          {axios.isAxiosError(error) ? (error.response?.data?.error ?? error.message) : 'Failed to load dashboard'}
        </p>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">
      <h1 className="text-3xl font-bold">Dashboard</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {STAT_TILES.map((tile) => (
          <Card key={tile.key}>
            <CardHeader>
              <CardDescription>{tile.label}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{tile.format(stats)}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">Tickets per day (last 30 days)</CardTitle>
        </CardHeader>
        <CardContent>
          <TicketsByDayChart data={stats.ticketsByDay} />
        </CardContent>
      </Card>
    </div>
  )
}
