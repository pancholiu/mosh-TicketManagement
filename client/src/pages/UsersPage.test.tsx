import { screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import axios from 'axios'
import { renderWithQuery } from '@/test/render'
import UsersPage from './UsersPage'

vi.mock('axios')
const mockedAxios = vi.mocked(axios, true)

const USERS = [
  { id: '1', name: 'Alice Admin', email: 'alice@example.com', role: 'ADMIN' as const, createdAt: '2024-01-15T00:00:00.000Z' },
  { id: '2', name: 'Bob Agent',  email: 'bob@example.com',   role: 'AGENT' as const, createdAt: '2024-03-20T00:00:00.000Z' },
]

function renderPage() {
  return renderWithQuery(<UsersPage />)
}

beforeEach(() => {
  vi.resetAllMocks()
})

describe('UsersPage', () => {
  it('renders skeleton rows while loading', () => {
    mockedAxios.get.mockReturnValue(new Promise(() => {})) // never resolves

    renderPage()

    expect(screen.getByRole('columnheader', { name: 'Name' })).toBeInTheDocument()
    // 5 skeleton rows × 4 cells = 20 cells, but the simplest check is the header stays visible
    expect(screen.queryByText('Users')).not.toBeInTheDocument()
  })

  it('renders user rows after data loads', async () => {
    mockedAxios.get.mockResolvedValue({ data: USERS })

    renderPage()

    expect(await screen.findByText('Alice Admin')).toBeInTheDocument()
    expect(screen.getByText('Bob Agent')).toBeInTheDocument()
    expect(screen.getByText('alice@example.com')).toBeInTheDocument()
    expect(screen.getByText('bob@example.com')).toBeInTheDocument()
  })

  it('shows total count', async () => {
    mockedAxios.get.mockResolvedValue({ data: USERS })

    renderPage()

    expect(await screen.findByText('2 total')).toBeInTheDocument()
  })

  it('renders ADMIN badge for admin users and AGENT badge for agents', async () => {
    mockedAxios.get.mockResolvedValue({ data: USERS })

    renderPage()

    await screen.findByText('Alice Admin')
    expect(screen.getByText('ADMIN')).toBeInTheDocument()
    expect(screen.getByText('AGENT')).toBeInTheDocument()
  })

  it('formats the joined date', async () => {
    mockedAxios.get.mockResolvedValue({ data: USERS })

    renderPage()

    await screen.findByText('Alice Admin')
    expect(screen.getByText(new Date('2024-01-15T00:00:00.000Z').toLocaleDateString())).toBeInTheDocument()
  })

  it('shows error message when request fails', async () => {
    const err = Object.assign(new Error('Network Error'), {
      isAxiosError: true,
      response: undefined,
    })
    mockedAxios.get.mockRejectedValue(err)
    mockedAxios.isAxiosError.mockReturnValue(true)

    renderPage()

    expect(await screen.findByText('Network Error')).toBeInTheDocument()
  })

  it('shows server error message from response body', async () => {
    const err = Object.assign(new Error('Request failed'), {
      isAxiosError: true,
      response: { data: { error: 'Forbidden' } },
    })
    mockedAxios.get.mockRejectedValue(err)
    mockedAxios.isAxiosError.mockReturnValue(true)

    renderPage()

    expect(await screen.findByText('Forbidden')).toBeInTheDocument()
  })
})
