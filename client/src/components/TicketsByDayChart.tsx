import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { TooltipContentProps } from 'recharts'

type DayCount = { date: string; count: number }

function formatAxisDate(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })
}

function ChartTooltip({ active, payload }: Partial<TooltipContentProps<number, string>>) {
  if (!active || !payload?.length) return null
  const point = payload[0].payload as DayCount
  const count = point.count

  return (
    <div className="rounded-md border bg-popover px-3 py-2 shadow-md text-sm">
      <p className="text-muted-foreground font-mono text-xs">{formatAxisDate(point.date)}</p>
      <p className="font-semibold text-foreground tabular-nums">
        {count} {count === 1 ? 'ticket' : 'tickets'}
      </p>
    </div>
  )
}

export function TicketsByDayChart({ data }: { data: DayCount[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis
          dataKey="date"
          tickFormatter={formatAxisDate}
          interval={Math.ceil(data.length / 8) - 1}
          tickLine={false}
          axisLine={{ stroke: 'var(--border)' }}
          tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
        />
        <YAxis
          allowDecimals={false}
          tickLine={false}
          axisLine={false}
          tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
          width={32}
        />
        <Tooltip cursor={{ fill: 'var(--muted)' }} content={<ChartTooltip />} />
        <Bar dataKey="count" fill="var(--chart-1)" radius={[4, 4, 0, 0]} maxBarSize={24} />
      </BarChart>
    </ResponsiveContainer>
  )
}
