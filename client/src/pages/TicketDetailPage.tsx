import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import axios from 'axios'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
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
type SenderType = 'AGENT' | 'CUSTOMER'

type Assignee = { id: string; name: string; email: string; role?: Role }

type Reply = {
  id: string
  body: string
  senderType: SenderType
  createdAt: string
  author: { id: string; name: string; email: string } | null
}

type TicketDetail = {
  id: string
  subject: string
  body: string
  from: string
  status: TicketStatus
  category: Category | null
  assignedTo: Assignee | null
  replies: Reply[]
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
        <SelectTrigger className="h-9 w-full px-1.5 text-xs">
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

const STATUS_LABEL: Record<TicketStatus, string> = {
  OPEN: 'Open',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
}

const CATEGORY_LABEL: Record<Category, string> = {
  GENERAL_QUESTION: 'General',
  TECHNICAL_QUESTION: 'Technical',
  REFUND_REQUEST: 'Refund',
}

const NO_CATEGORY = 'NONE'

async function updateTicket(
  id: string,
  data: { status?: TicketStatus; category?: Category | null }
): Promise<TicketDetail> {
  const res = await axios.patch<TicketDetail>(`/api/tickets/${id}`, data)
  return res.data
}

function TicketStatusSelect({ ticket }: { ticket: TicketDetail }) {
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: (status: TicketStatus) => updateTicket(ticket.id, { status }),
    onSuccess: (updated) => {
      queryClient.setQueryData(['tickets', ticket.id], updated)
    },
  })

  return (
    <Select
      value={ticket.status}
      onValueChange={(value) => mutation.mutate(value as TicketStatus)}
      disabled={mutation.isPending}
    >
      <SelectTrigger className="h-9 w-full px-1.5 text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {(Object.keys(STATUS_LABEL) as TicketStatus[]).map((status) => (
          <SelectItem key={status} value={status}>
            {STATUS_LABEL[status]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function TicketCategorySelect({ ticket }: { ticket: TicketDetail }) {
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: (category: Category | null) => updateTicket(ticket.id, { category }),
    onSuccess: (updated) => {
      queryClient.setQueryData(['tickets', ticket.id], updated)
    },
  })

  return (
    <Select
      value={ticket.category ?? NO_CATEGORY}
      onValueChange={(value) => mutation.mutate(value === NO_CATEGORY ? null : (value as Category))}
      disabled={mutation.isPending}
    >
      <SelectTrigger className="h-9 w-full px-1.5 text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NO_CATEGORY}>Uncategorized</SelectItem>
        {(Object.keys(CATEGORY_LABEL) as Category[]).map((category) => (
          <SelectItem key={category} value={category}>
            {CATEGORY_LABEL[category]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

async function fetchTicket(id: string): Promise<TicketDetail> {
  const res = await axios.get<TicketDetail>(`/api/tickets/${id}`)
  return res.data
}

async function createReply(ticketId: string, body: string): Promise<Reply> {
  const res = await axios.post<Reply>(`/api/tickets/${ticketId}/replies`, { body })
  return res.data
}

function ReplyList({ replies }: { replies: Reply[] }) {
  if (replies.length === 0) {
    return <p className="text-sm text-muted-foreground">No replies yet.</p>
  }

  return (
    <div className="divide-y divide-border">
      {replies.map((reply) => (
        <div key={reply.id} className="py-4 first:pt-0 space-y-1">
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-medium">{reply.author?.name ?? 'Customer'}</span>
            <Badge variant={reply.senderType === 'AGENT' ? 'default' : 'secondary'} className="text-[10px]">
              {reply.senderType === 'AGENT' ? 'Agent' : 'Customer'}
            </Badge>
            <span className="text-xs text-muted-foreground">{new Date(reply.createdAt).toLocaleString()}</span>
          </div>
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{reply.body}</p>
        </div>
      ))}
    </div>
  )
}

const replySchema = z.object({
  body: z.string().trim().min(1, 'Reply cannot be empty'),
})

type ReplyFormValues = z.infer<typeof replySchema>

function ReplyForm({ ticketId }: { ticketId: string }) {
  const queryClient = useQueryClient()

  const form = useForm<ReplyFormValues>({
    resolver: zodResolver(replySchema),
    defaultValues: { body: '' },
  })

  const mutation = useMutation({
    mutationFn: (values: ReplyFormValues) => createReply(ticketId, values.body),
    onSuccess: (reply) => {
      queryClient.setQueryData<TicketDetail>(['tickets', ticketId], (old) =>
        old ? { ...old, replies: [...old.replies, reply] } : old
      )
      form.reset()
    },
    onError: (err) => {
      const message = axios.isAxiosError(err)
        ? (err.response?.data?.error ?? err.message)
        : 'Failed to submit reply'
      form.setError('root', { message })
    },
  })

  function onSubmit(values: ReplyFormValues) {
    mutation.mutate(values)
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
        <FormField
          control={form.control}
          name="body"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Reply</FormLabel>
              <FormControl>
                <Textarea rows={4} placeholder="Write a reply…" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {form.formState.errors.root && (
          <p className="text-sm text-destructive">{form.formState.errors.root.message}</p>
        )}

        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? 'Sending…' : 'Send reply'}
        </Button>
      </form>
    </Form>
  )
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
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-8 w-2/3" />
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_140px] gap-8">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
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
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">
      <Button variant="ghost" size="sm" className="-ml-2" asChild>
        <Link to="/tickets">
          <ArrowLeft className="size-4" />
          Back to tickets
        </Link>
      </Button>

      <h1 className="text-3xl font-bold">{ticket.subject}</h1>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_140px] gap-8 items-start">
        <div className="min-w-0 space-y-6">
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
            <div>
              <dt className="text-muted-foreground">From</dt>
              <dd className="font-medium">{ticket.from}</dd>
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

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Replies</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <ReplyList replies={ticket.replies} />
              <ReplyForm ticketId={ticket.id} />
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="p-3">
            <CardTitle className="text-base">Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 p-3 pt-0">
            <div className="space-y-1.5">
              <label className="text-sm text-muted-foreground">Status</label>
              <TicketStatusSelect ticket={ticket} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm text-muted-foreground">Category</label>
              <TicketCategorySelect ticket={ticket} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm text-muted-foreground">Assigned to</label>
              <AssignTicketSelect ticket={ticket} />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
