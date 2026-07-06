import { screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import axios from 'axios'
import { renderWithQuery } from '@/test/render'
import DashboardPage from './DashboardPage'

vi.mock('axios')
const mockedAxios = vi.mocked(axios, true)

const STATS = {
  totalTickets: 42,
  openTickets: 7,
  resolvedByAiCount: 20,
  resolvedByAiPercent: 47.6190476,
  avgResolutionTimeMs: 3 * 60 * 60 * 1000 + 20 * 60 * 1000,
  ticketsByDay: Array.from({ length: 30 }, (_, i) => ({
    date: new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    count: i % 5,
  })),
}

function renderPage() {
  return renderWithQuery(<DashboardPage />)
}

beforeEach(() => {
  vi.resetAllMocks()
})

describe('DashboardPage', () => {
  it('renders skeleton tiles while loading', () => {
    mockedAxios.get.mockReturnValue(new Promise(() => {})) // never resolves

    renderPage()

    expect(screen.getByText('Total Tickets')).toBeInTheDocument()
    expect(screen.queryByText('42')).not.toBeInTheDocument()
  })

  it('renders all five stat tiles with formatted values', async () => {
    mockedAxios.get.mockResolvedValue({ data: STATS })

    renderPage()

    expect(await screen.findByText('42')).toBeInTheDocument()
    expect(screen.getByText('7')).toBeInTheDocument()
    expect(screen.getByText('20')).toBeInTheDocument()
    expect(screen.getByText('47.6%')).toBeInTheDocument()
    expect(screen.getByText('3h 20m')).toBeInTheDocument()
  })

  it('shows a dash for average resolution time when there are no resolved tickets', async () => {
    mockedAxios.get.mockResolvedValue({
      data: { ...STATS, avgResolutionTimeMs: null },
    })

    renderPage()

    expect(await screen.findByText('—')).toBeInTheDocument()
  })

  it('formats resolution times of a day or more in days and hours', async () => {
    mockedAxios.get.mockResolvedValue({
      data: { ...STATS, avgResolutionTimeMs: 2 * 24 * 60 * 60 * 1000 + 5 * 60 * 60 * 1000 },
    })

    renderPage()

    expect(await screen.findByText('2d 5h')).toBeInTheDocument()
  })

  it('renders the tickets-per-day chart title once data loads', async () => {
    mockedAxios.get.mockResolvedValue({ data: STATS })

    renderPage()

    expect(await screen.findByText('Tickets per day (last 30 days)')).toBeInTheDocument()
  })

  it('shows an error message when the request fails', async () => {
    const err = Object.assign(new Error('Network Error'), {
      isAxiosError: true,
      response: { data: { error: 'Failed to load stats' } },
    })
    mockedAxios.get.mockRejectedValue(err)
    mockedAxios.isAxiosError.mockReturnValue(true)

    renderPage()

    expect(await screen.findByText('Failed to load stats')).toBeInTheDocument()
  })
})
