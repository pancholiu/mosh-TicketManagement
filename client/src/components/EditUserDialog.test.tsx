import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import axios from 'axios'
import { renderWithQuery } from '@/test/render'
import EditUserDialog from './EditUserDialog'

vi.mock('axios')
const mockedAxios = vi.mocked(axios, true)

const USER = {
  id: 'user-1',
  name: 'Alice Smith',
  email: 'alice@example.com',
  role: 'AGENT' as const,
}

async function openDialog(user = USER) {
  const events = userEvent.setup()
  renderWithQuery(<EditUserDialog user={user} />)
  await events.click(screen.getByRole('button', { name: 'Edit user' }))
  return events
}

beforeEach(() => {
  vi.resetAllMocks()
})

describe('EditUserDialog - form fields', () => {
  it('pre-fills name and email from the user prop', async () => {
    await openDialog()

    expect(screen.getByLabelText('Name')).toHaveValue('Alice Smith')
    expect(screen.getByLabelText('Email')).toHaveValue('alice@example.com')
  })

  it('starts with an empty password field', async () => {
    await openDialog()

    expect(screen.getByLabelText('Password')).toHaveValue('')
  })
})

describe('EditUserDialog - validation', () => {
  it('shows error when name is shorter than 3 characters', async () => {
    const events = await openDialog()

    await events.clear(screen.getByLabelText('Name'))
    await events.type(screen.getByLabelText('Name'), 'AB')
    await events.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('Name must be at least 3 characters')).toBeInTheDocument()
  })

  it('shows error when email is invalid', async () => {
    const events = await openDialog()

    await events.clear(screen.getByLabelText('Email'))
    await events.type(screen.getByLabelText('Email'), 'not-an-email')
    await events.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('Enter a valid email')).toBeInTheDocument()
  })

  it('shows error when password is non-empty but shorter than 8 characters', async () => {
    const events = await openDialog()

    await events.type(screen.getByLabelText('Password'), '1234567')
    await events.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('Password must be at least 8 characters')).toBeInTheDocument()
  })

  it('does not show a password error when password is left blank', async () => {
    mockedAxios.patch.mockResolvedValue({ data: {} })
    const events = await openDialog()

    await events.click(screen.getByRole('button', { name: 'Save' }))

    expect(screen.queryByText('Password must be at least 8 characters')).not.toBeInTheDocument()
  })

  it('does not call PATCH when the form is invalid', async () => {
    const events = await openDialog()

    await events.clear(screen.getByLabelText('Name'))
    await events.type(screen.getByLabelText('Name'), 'AB')
    await events.click(screen.getByRole('button', { name: 'Save' }))

    expect(mockedAxios.patch).not.toHaveBeenCalled()
  })
})

describe('EditUserDialog - submission', () => {
  it('calls PATCH /api/users/:id without password when left blank', async () => {
    mockedAxios.patch.mockResolvedValue({ data: {} })
    const events = await openDialog()

    await events.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(mockedAxios.patch).toHaveBeenCalledWith('/api/users/user-1', {
        name: 'Alice Smith',
        email: 'alice@example.com',
      })
    })
  })

  it('calls PATCH /api/users/:id with password when provided', async () => {
    mockedAxios.patch.mockResolvedValue({ data: {} })
    const events = await openDialog()

    await events.type(screen.getByLabelText('Password'), 'newpassword123')
    await events.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(mockedAxios.patch).toHaveBeenCalledWith('/api/users/user-1', {
        name: 'Alice Smith',
        email: 'alice@example.com',
        password: 'newpassword123',
      })
    })
  })

  it('closes the dialog after successful submission', async () => {
    mockedAxios.patch.mockResolvedValue({ data: {} })
    const events = await openDialog()

    await events.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })

  it('shows the server error message on failure', async () => {
    const err = Object.assign(new Error('Request failed'), {
      isAxiosError: true,
      response: { data: { error: 'Email already registered' } },
    })
    mockedAxios.patch.mockRejectedValue(err)
    mockedAxios.isAxiosError.mockReturnValue(true)
    const events = await openDialog()

    await events.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('Email already registered')).toBeInTheDocument()
  })

  it('keeps the dialog open after a server error', async () => {
    const err = Object.assign(new Error('Request failed'), {
      isAxiosError: true,
      response: { data: { error: 'Email already registered' } },
    })
    mockedAxios.patch.mockRejectedValue(err)
    mockedAxios.isAxiosError.mockReturnValue(true)
    const events = await openDialog()

    await events.click(screen.getByRole('button', { name: 'Save' }))

    await screen.findByText('Email already registered')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})
