import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import axios from 'axios'
import { renderWithQuery } from '@/test/render'
import DeleteUserButton from './DeleteUserButton'

vi.mock('axios')
const mockedAxios = vi.mocked(axios, true)

const USER = { userId: 'user-1', userName: 'Alice Smith' }

async function openDialog(props = USER) {
  const events = userEvent.setup()
  renderWithQuery(<DeleteUserButton {...props} />)
  await events.click(screen.getByRole('button', { name: 'Delete user' }))
  return events
}

beforeEach(() => {
  vi.resetAllMocks()
})

describe('DeleteUserButton - rendering', () => {
  it('renders the delete button', () => {
    renderWithQuery(<DeleteUserButton {...USER} />)
    expect(screen.getByRole('button', { name: 'Delete user' })).toBeInTheDocument()
  })

  it('opens a confirmation dialog when clicked', async () => {
    await openDialog()
    expect(screen.getByRole('alertdialog')).toBeInTheDocument()
  })

  it('shows the user name in the confirmation dialog', async () => {
    await openDialog()
    expect(screen.getByText(/Alice Smith/)).toBeInTheDocument()
  })
})

describe('DeleteUserButton - cancellation', () => {
  it('closes the dialog when Cancel is clicked', async () => {
    const events = await openDialog()
    await events.click(screen.getByRole('button', { name: 'Cancel' }))
    await waitFor(() => {
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    })
  })

  it('does not call DELETE when Cancel is clicked', async () => {
    const events = await openDialog()
    await events.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(mockedAxios.delete).not.toHaveBeenCalled()
  })
})

describe('DeleteUserButton - submission', () => {
  it('calls DELETE /api/users/:id when Delete is clicked', async () => {
    mockedAxios.delete.mockResolvedValue({ data: {} })
    const events = await openDialog()
    await events.click(screen.getByRole('button', { name: 'Delete' }))
    await waitFor(() => {
      expect(mockedAxios.delete).toHaveBeenCalledWith('/api/users/user-1')
    })
  })

  it('closes the dialog after successful deletion', async () => {
    mockedAxios.delete.mockResolvedValue({ data: {} })
    const events = await openDialog()
    await events.click(screen.getByRole('button', { name: 'Delete' }))
    await waitFor(() => {
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    })
  })

  it('shows an error message when deletion fails', async () => {
    const err = Object.assign(new Error('Request failed'), {
      isAxiosError: true,
      response: { data: { error: 'User not found' } },
    })
    mockedAxios.delete.mockRejectedValue(err)
    mockedAxios.isAxiosError.mockReturnValue(true)
    const events = await openDialog()
    await events.click(screen.getByRole('button', { name: 'Delete' }))
    expect(await screen.findByText('User not found')).toBeInTheDocument()
  })

  it('keeps the dialog open after a failed deletion', async () => {
    const err = Object.assign(new Error('Request failed'), {
      isAxiosError: true,
      response: { data: { error: 'User not found' } },
    })
    mockedAxios.delete.mockRejectedValue(err)
    mockedAxios.isAxiosError.mockReturnValue(true)
    const events = await openDialog()
    await events.click(screen.getByRole('button', { name: 'Delete' }))
    await screen.findByText('User not found')
    expect(screen.getByRole('alertdialog')).toBeInTheDocument()
  })
})
