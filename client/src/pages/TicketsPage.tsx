import axios from 'axios'
import { useQuery } from '@tanstack/react-query'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

type TicketStatus = 'OPEN' | 'RESOLVED' | 'CLOSED'
type Category = 'GENERAL_QUESTION' | 'TECHNICAL_QUESTION' | 'REFUND_REQUEST'

type Ticket = {
  id: string
  subject: string
  from: string
  status: TicketStatus
  category: Category | null
  createdAt: string
}

const STATUS_VARIANT: Record<TicketStatus, 'default' | 'secondary' | 'outline'> = {
  OPEN: 'default',
  RESOLVED: 'secondary',
  CLOSED: 'outline',
}

const CATEGORY_LABEL: Record<Category, string> = {
  GENERAL_QUESTION: 'General',
  TECHNICAL_QUESTION: 'Technical',
  REFUND_REQUEST: 'Refund',
}

async function fetchTickets(): Promise<Ticket[]> {
  const res = await axios.get<Ticket[]>('/api/tickets')
  return res.data
}

export default function TicketsPage() {
  const { data: tickets, isPending, error } = useQuery({
    queryKey: ['tickets'],
    queryFn: fetchTickets,
  })

  if (isPending) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">
        <Skeleton className="h-9 w-24" />
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Subject</TableHead>
                <TableHead>From</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Received</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-16 rounded-full" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-20 rounded-full" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-destructive">
          {axios.isAxiosError(error) ? (error.response?.data?.error ?? error.message) : 'Failed to load tickets'}
        </p>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">
      <div className="flex items-baseline gap-3">
        <h1 className="text-3xl font-bold">Tickets</h1>
        <span className="text-muted-foreground text-sm">{tickets.length} total</span>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Subject</TableHead>
              <TableHead>From</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Received</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tickets.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                  No tickets yet
                </TableCell>
              </TableRow>
            ) : (
              tickets.map((ticket) => (
                <TableRow key={ticket.id}>
                  <TableCell className="font-medium">{ticket.subject}</TableCell>
                  <TableCell className="text-muted-foreground">{ticket.from}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[ticket.status]}>
                      {ticket.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {ticket.category ? (
                      <Badge variant="outline">{CATEGORY_LABEL[ticket.category]}</Badge>
                    ) : (
                      <span className="text-muted-foreground text-sm">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(ticket.createdAt).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
