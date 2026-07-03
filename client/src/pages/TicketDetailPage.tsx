import axios from 'axios'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type TicketStatus = 'OPEN' | 'RESOLVED' | 'CLOSED'
type Category = 'GENERAL_QUESTION' | 'TECHNICAL_QUESTION' | 'REFUND_REQUEST'
type Role = 'ADMIN' | 'AGENT'

type Assignee = { id: string; name: string; email: string; role?: Role }

type TicketDetail = {
  id: string
  subject: string
  body: string
  from: string
  status: TicketStatus
  category: Category | null
  assignedTo: Assignee | null
  createdAt: string
  updatedAt: string
}

const UNASSIGNED = 'UNASSIGNED'

async function fetchAssignees(): Promise<Assignee[]> {
  const res = await axios.get<Assignee[]>('/api/tickets/assignees')
  return res.data
}

async function assignTicket(id: string, assignedToId: string | null): Promise<TicketDetail> {
  const res = await axios.patch<TicketDetail>(`/api/tickets/${id}/assign`, { assignedToId })
  return res.data
}

function AssignTicketSelect({ ticket }: { ticket: TicketDetail }) {
  const queryClient = useQueryClient()

  const { data: assignees } = useQuery({ queryKey: ['tickets', 'assignees'], queryFn: fetchAssignees })

  const mutation = useMutation({
    mutationFn: (assignedToId: string | null) => assignTicket(ticket.id, assignedToId),
    onSuccess: (updated) => {
      queryClient.setQueryData(['tickets', ticket.id], updated)
    },
  })

  return (
    <div className="space-y-1">
      <Select
        value={ticket.assignedTo?.id ?? UNASSIGNED}
        onValueChange={(value) => mutation.mutate(value === UNASSIGNED ? null : value)}
        disabled={mutation.isPending}
      >
        <SelectTrigger className="h-8 w-56">
          <SelectValue placeholder="Unassigned" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
          {assignees?.map((assignee) => (
            <SelectItem key={assignee.id} value={assignee.id}>
              {assignee.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {mutation.isError && (
        <p className="text-xs text-destructive">
          {axios.isAxiosError(mutation.error)
            ? (mutation.error.response?.data?.error ?? mutation.error.message)
            : 'Failed to assign ticket'}
        </p>
      )}
    </div>
  )
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

async function fetchTicket(id: string): Promise<TicketDetail> {
  const res = await axios.get<TicketDetail>(`/api/tickets/${id}`)
  return res.data
}

export default function TicketDetailPage() {
  const { id } = useParams<{ id: string }>()

  const { data: ticket, isPending, error } = useQuery({
    queryKey: ['tickets', id],
    queryFn: () => fetchTicket(id!),
    enabled: !!id,
  })

  if (isPending) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  if (error) {
    const isNotFound = axios.isAxiosError(error) && error.response?.status === 404
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20">
        <p className="text-destructive">
          {isNotFound
            ? 'Ticket not found'
            : axios.isAxiosError(error)
              ? (error.response?.data?.error ?? error.message)
              : 'Failed to load ticket'}
        </p>
        <Button variant="outline" asChild>
          <Link to="/tickets">
            <ArrowLeft className="size-4" />
            Back to tickets
          </Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">
      <Button variant="ghost" size="sm" className="-ml-2" asChild>
        <Link to="/tickets">
          <ArrowLeft className="size-4" />
          Back to tickets
        </Link>
      </Button>

      <div className="space-y-3">
        <h1 className="text-3xl font-bold">{ticket.subject}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={STATUS_VARIANT[ticket.status]}>{ticket.status}</Badge>
          {ticket.category ? (
            <Badge variant="outline">{CATEGORY_LABEL[ticket.category]}</Badge>
          ) : (
            <Badge variant="outline" className="text-muted-foreground">
              Uncategorized
            </Badge>
          )}
        </div>
      </div>

      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
        <div>
          <dt className="text-muted-foreground">From</dt>
          <dd className="font-medium">{ticket.from}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Assigned to</dt>
          <dd className="font-medium">
            <AssignTicketSelect ticket={ticket} />
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Received</dt>
          <dd className="font-medium">{new Date(ticket.createdAt).toLocaleString()}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Last updated</dt>
          <dd className="font-medium">{new Date(ticket.updatedAt).toLocaleString()}</dd>
        </div>
      </dl>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Message</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{ticket.body}</p>
        </CardContent>
      </Card>
    </div>
  )
}
