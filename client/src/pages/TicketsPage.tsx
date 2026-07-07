import { useEffect, useState } from 'react'
import axios from 'axios'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import {
  useReactTable,
  getCoreRowModel,
  createColumnHelper,
  flexRender,
  type SortingState,
} from '@tanstack/react-table'
import { ArrowUp, ArrowDown, ArrowUpDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { TextLink, linkVariants } from '@/components/ui/link'
import { StatusIndicator, type TicketStatus } from '@/components/StatusIndicator'
import { cn } from '@/lib/utils'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

type Category = 'GENERAL_QUESTION' | 'TECHNICAL_QUESTION' | 'REFUND_REQUEST'

type Ticket = {
  id: string
  subject: string
  from: string
  status: TicketStatus
  category: Category | null
  createdAt: string
}

const CATEGORY_LABEL: Record<Category, string> = {
  GENERAL_QUESTION: 'General',
  TECHNICAL_QUESTION: 'Technical',
  REFUND_REQUEST: 'Refund',
}

type Filters = {
  status: TicketStatus | 'ALL'
  category: Category | 'NONE' | 'ALL'
  search: string
}

type TicketsPage = {
  data: Ticket[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

const PAGE_SIZE = 10

async function fetchTickets(sorting: SortingState, filters: Filters, page: number): Promise<TicketsPage> {
  const sort = sorting[0]
  const res = await axios.get<TicketsPage>('/api/tickets', {
    params: {
      sortBy: sort?.id,
      sortOrder: sort ? (sort.desc ? 'desc' : 'asc') : undefined,
      status: filters.status === 'ALL' ? undefined : filters.status,
      category: filters.category === 'ALL' ? undefined : filters.category,
      search: filters.search || undefined,
      page,
      pageSize: PAGE_SIZE,
    },
  })
  return res.data
}

const columnHelper = createColumnHelper<Ticket>()

const columns = [
  columnHelper.accessor('subject', {
    header: 'Subject',
    cell: (info) => (
      <TextLink to={`/tickets/${info.row.original.id}`} variant="subtle" className="font-medium text-foreground">
        {info.getValue()}
      </TextLink>
    ),
  }),
  columnHelper.accessor('from', {
    header: 'From',
    cell: (info) => <span className="text-muted-foreground">{info.getValue()}</span>,
  }),
  columnHelper.accessor('status', {
    header: 'Status',
    cell: (info) => <StatusIndicator status={info.getValue()} />,
  }),
  columnHelper.accessor('category', {
    header: 'Category',
    cell: (info) => {
      const value = info.getValue()
      return value ? (
        <Badge variant="outline">{CATEGORY_LABEL[value]}</Badge>
      ) : (
        <span className="text-muted-foreground text-sm">—</span>
      )
    },
  }),
  columnHelper.accessor('createdAt', {
    header: 'Received',
    cell: (info) => (
      <span className="text-muted-foreground font-mono text-xs">
        {new Date(info.getValue()).toLocaleDateString()}
      </span>
    ),
  }),
]

export default function TicketsPage() {
  const [sorting, setSorting] = useState<SortingState>([])
  const [status, setStatus] = useState<Filters['status']>('ALL')
  const [category, setCategory] = useState<Filters['category']>('ALL')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  useEffect(() => {
    const timeout = setTimeout(() => setSearch(searchInput.trim()), 300)
    return () => clearTimeout(timeout)
  }, [searchInput])

  const filters: Filters = { status, category, search }

  // Reset to page 1 whenever sorting or filters change, so the user isn't
  // left stranded on a page number that no longer has results.
  useEffect(() => {
    setPage(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sorting, status, category, search])

  const { data: result, isPending, error } = useQuery({
    queryKey: ['tickets', sorting, filters, page],
    queryFn: () => fetchTickets(sorting, filters, page),
    placeholderData: keepPreviousData,
  })

  const tickets = result?.data
  const totalPages = result?.totalPages ?? 1

  const table = useReactTable({
    data: tickets ?? [],
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    manualSorting: true,
    manualPagination: true,
    pageCount: totalPages,
    getCoreRowModel: getCoreRowModel(),
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
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
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

  const hasActiveFilters = status !== 'ALL' || category !== 'ALL' || search !== ''

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">
      <div className="flex items-baseline gap-3">
        <h1 className="font-display text-3xl font-semibold tracking-tight">Tickets</h1>
        <span className="text-muted-foreground font-mono text-xs">{result.total} total</span>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="Search subject or sender..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="max-w-xs"
        />
        <Select value={status} onValueChange={(value) => setStatus(value as Filters['status'])}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All statuses</SelectItem>
            <SelectItem value="NEW">New</SelectItem>
            <SelectItem value="PROCESSING">Processing</SelectItem>
            <SelectItem value="OPEN">Open</SelectItem>
            <SelectItem value="RESOLVED">Resolved</SelectItem>
            <SelectItem value="CLOSED">Closed</SelectItem>
          </SelectContent>
        </Select>
        <Select value={category} onValueChange={(value) => setCategory(value as Filters['category'])}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All categories</SelectItem>
            <SelectItem value="GENERAL_QUESTION">General</SelectItem>
            <SelectItem value="TECHNICAL_QUESTION">Technical</SelectItem>
            <SelectItem value="REFUND_REQUEST">Refund</SelectItem>
            <SelectItem value="NONE">Uncategorized</SelectItem>
          </SelectContent>
        </Select>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={() => {
              setStatus('ALL')
              setCategory('ALL')
              setSearchInput('')
            }}
            className={cn(linkVariants({ variant: 'nav' }), 'underline underline-offset-2')}
          >
            Clear filters
          </button>
        )}
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    <button
                      type="button"
                      className="flex items-center gap-1 -ml-2 px-2 py-1 rounded hover:bg-muted/50"
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {header.column.getIsSorted() === 'asc' && <ArrowUp className="size-3.5" />}
                      {header.column.getIsSorted() === 'desc' && <ArrowDown className="size-3.5" />}
                      {!header.column.getIsSorted() && (
                        <ArrowUpDown className="size-3.5 text-muted-foreground/50" />
                      )}
                    </button>
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="text-center py-10 text-muted-foreground">
                  {hasActiveFilters ? 'No tickets match your filters' : 'No tickets yet'}
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-muted-foreground font-mono text-xs">
          Page {result.page} of {totalPages}
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => p - 1)}
            disabled={result.page <= 1}
          >
            <ChevronLeft className="size-4" />
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => p + 1)}
            disabled={result.page >= totalPages}
          >
            Next
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
