import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import axios from 'axios'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { renderWithQuery } from '@/test/render'
import TicketDetailPage from './TicketDetailPage'

vi.mock('axios')
const mockedAxios = vi.mocked(axios, true)

const TICKET_ID = 't1'

const BASE_TICKET = {
  id: TICKET_ID,
  subject: 'Cannot log in',
  body: 'I keep getting an invalid credentials error.',
  from: 'customer@example.com',
  status: 'OPEN' as const,
  category: null,
  assignedTo: null,
  replies: [] as Array<{
    id: string
    body: string
    senderType: 'AGENT' | 'CUSTOMER'
    createdAt: string
    author: { id: string; name: string; email: string } | null
  }>,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

function mockTicketAndAssignees(ticket: typeof BASE_TICKET) {
  mockedAxios.get.mockImplementation((url: string) => {
    if (url === '/api/tickets/assignees') return Promise.resolve({ data: [] })
    if (url === `/api/tickets/${ticket.id}`) return Promise.resolve({ data: ticket })
    return Promise.reject(new Error(`Unexpected GET ${url}`))
  })
}

function renderPage() {
  return renderWithQuery(
    <MemoryRouter initialEntries={[`/tickets/${TICKET_ID}`]}>
      <Routes>
        <Route path="/tickets/:id" element={<TicketDetailPage />} />
      </Routes>
    </MemoryRouter>
  )
}

beforeEach(() => {
  vi.resetAllMocks()
})

describe('TicketDetailPage', () => {
  it('renders ticket subject, sender and message body after loading', async () => {
    mockTicketAndAssignees(BASE_TICKET)

    renderPage()

    expect(await screen.findByText('Cannot log in')).toBeInTheDocument()
    expect(screen.getByText('customer@example.com')).toBeInTheDocument()
    expect(screen.getByText('I keep getting an invalid credentials error.')).toBeInTheDocument()
  })

  it('shows "Ticket not found" for a 404 response', async () => {
    const err = Object.assign(new Error('Not Found'), {
      isAxiosError: true,
      response: { status: 404 },
    })
    mockedAxios.get.mockRejectedValue(err)
    mockedAxios.isAxiosError.mockReturnValue(true)

    renderPage()

    expect(await screen.findByText('Ticket not found')).toBeInTheDocument()
  })
})

describe('TicketDetailPage - reply thread', () => {
  it('shows "No replies yet." when the ticket has no replies', async () => {
    mockTicketAndAssignees(BASE_TICKET)

    renderPage()

    expect(await screen.findByText('No replies yet.')).toBeInTheDocument()
  })

  it('renders each reply with author name, sender badge and body', async () => {
    mockTicketAndAssignees({
      ...BASE_TICKET,
      replies: [
        {
          id: 'r1',
          body: 'Thanks for reaching out, looking into it now.',
          senderType: 'AGENT',
          createdAt: '2026-01-02T00:00:00.000Z',
          author: { id: 'u1', name: 'Admin', email: 'admin@example.com' },
        },
      ],
    })

    renderPage()

    expect(await screen.findByText('Thanks for reaching out, looking into it now.')).toBeInTheDocument()
    expect(screen.getByText('Admin')).toBeInTheDocument()
    expect(screen.getByText('Agent')).toBeInTheDocument()
  })

  it('falls back to "Customer" label and badge for a reply with no author', async () => {
    mockTicketAndAssignees({
      ...BASE_TICKET,
      replies: [
        {
          id: 'r2',
          body: 'Actually, it started happening again.',
          senderType: 'CUSTOMER',
          createdAt: '2026-01-03T00:00:00.000Z',
          author: null,
        },
      ],
    })

    renderPage()

    await screen.findByText('Actually, it started happening again.')
    expect(screen.getAllByText('Customer')).toHaveLength(2) // name fallback + badge
  })

  it('renders multiple replies in the given order', async () => {
    mockTicketAndAssignees({
      ...BASE_TICKET,
      replies: [
        {
          id: 'r1',
          body: 'First reply body',
          senderType: 'AGENT',
          createdAt: '2026-01-02T00:00:00.000Z',
          author: { id: 'u1', name: 'Admin', email: 'admin@example.com' },
        },
        {
          id: 'r2',
          body: 'Second reply body',
          senderType: 'AGENT',
          createdAt: '2026-01-03T00:00:00.000Z',
          author: { id: 'u1', name: 'Admin', email: 'admin@example.com' },
        },
      ],
    })

    renderPage()

    await screen.findByText('First reply body')
    const bodies = screen.getAllByText(/reply body/)
    expect(bodies.map((el) => el.textContent)).toEqual(['First reply body', 'Second reply body'])
  })
})

describe('TicketDetailPage - reply form validation', () => {
  it('shows an error and does not submit when the reply is empty', async () => {
    mockTicketAndAssignees(BASE_TICKET)
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Cannot log in')

    await user.click(screen.getByRole('button', { name: 'Send reply' }))

    expect(await screen.findByText('Reply cannot be empty')).toBeInTheDocument()
    expect(mockedAxios.post).not.toHaveBeenCalled()
  })

  it('shows an error and does not submit when the reply is whitespace-only', async () => {
    mockTicketAndAssignees(BASE_TICKET)
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Cannot log in')

    await user.type(screen.getByLabelText('Reply'), '   ')
    await user.click(screen.getByRole('button', { name: 'Send reply' }))

    expect(await screen.findByText('Reply cannot be empty')).toBeInTheDocument()
    expect(mockedAxios.post).not.toHaveBeenCalled()
  })
})

describe('TicketDetailPage - reply submission', () => {
  it('posts the reply body to the ticket replies endpoint', async () => {
    mockTicketAndAssignees(BASE_TICKET)
    mockedAxios.post.mockResolvedValue({
      data: {
        id: 'r1',
        body: 'On it, will follow up shortly.',
        senderType: 'AGENT',
        createdAt: '2026-01-02T00:00:00.000Z',
        author: { id: 'u1', name: 'Admin', email: 'admin@example.com' },
      },
    })
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Cannot log in')

    await user.type(screen.getByLabelText('Reply'), 'On it, will follow up shortly.')
    await user.click(screen.getByRole('button', { name: 'Send reply' }))

    await waitFor(() => {
      expect(mockedAxios.post).toHaveBeenCalledWith(`/api/tickets/${TICKET_ID}/replies`, {
        body: 'On it, will follow up shortly.',
      })
    })
  })

  it('appends the new reply to the thread and clears the textarea on success', async () => {
    mockTicketAndAssignees(BASE_TICKET)
    mockedAxios.post.mockResolvedValue({
      data: {
        id: 'r1',
        body: 'On it, will follow up shortly.',
        senderType: 'AGENT',
        createdAt: '2026-01-02T00:00:00.000Z',
        author: { id: 'u1', name: 'Admin', email: 'admin@example.com' },
      },
    })
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Cannot log in')
    expect(screen.getByText('No replies yet.')).toBeInTheDocument()

    const textarea = screen.getByLabelText('Reply')
    await user.type(textarea, 'On it, will follow up shortly.')
    await user.click(screen.getByRole('button', { name: 'Send reply' }))

    expect(await screen.findByText('On it, will follow up shortly.')).toBeInTheDocument()
    expect(screen.queryByText('No replies yet.')).not.toBeInTheDocument()
    await waitFor(() => {
      expect(textarea).toHaveValue('')
    })
  })

  it('shows the server error message when the reply submission fails', async () => {
    mockTicketAndAssignees(BASE_TICKET)
    const err = Object.assign(new Error('Request failed'), {
      isAxiosError: true,
      response: { data: { error: 'Ticket not found' } },
    })
    mockedAxios.post.mockRejectedValue(err)
    mockedAxios.isAxiosError.mockReturnValue(true)
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Cannot log in')

    await user.type(screen.getByLabelText('Reply'), 'On it, will follow up shortly.')
    await user.click(screen.getByRole('button', { name: 'Send reply' }))

    expect(await screen.findByText('Ticket not found')).toBeInTheDocument()
  })
})

describe('TicketDetailPage - polish reply', () => {
  it('disables the Polish button when the draft is empty', async () => {
    mockTicketAndAssignees(BASE_TICKET)
    renderPage()
    await screen.findByText('Cannot log in')

    expect(screen.getByRole('button', { name: /Polish/ })).toBeDisabled()
  })

  it('sends the draft body to the polish-reply endpoint and fills in the result', async () => {
    mockTicketAndAssignees(BASE_TICKET)
    mockedAxios.post.mockResolvedValue({ data: { body: 'Thank you for reaching out — I am looking into this now.' } })
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Cannot log in')

    const textarea = screen.getByLabelText('Reply')
    await user.type(textarea, 'looking into it')
    await user.click(screen.getByRole('button', { name: /Polish/ }))

    await waitFor(() => {
      expect(mockedAxios.post).toHaveBeenCalledWith(`/api/tickets/${TICKET_ID}/polish-reply`, {
        body: 'looking into it',
      })
    })
    expect(await screen.findByDisplayValue('Thank you for reaching out — I am looking into this now.')).toBeInTheDocument()
  })

  it('shows the server error message when polishing fails', async () => {
    mockTicketAndAssignees(BASE_TICKET)
    const err = Object.assign(new Error('Request failed'), {
      isAxiosError: true,
      response: { data: { error: 'Failed to polish reply' } },
    })
    mockedAxios.post.mockRejectedValue(err)
    mockedAxios.isAxiosError.mockReturnValue(true)
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Cannot log in')

    await user.type(screen.getByLabelText('Reply'), 'looking into it')
    await user.click(screen.getByRole('button', { name: /Polish/ }))

    expect(await screen.findByText('Failed to polish reply')).toBeInTheDocument()
  })
})
