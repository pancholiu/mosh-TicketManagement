import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import axios from 'axios'
import { renderWithQuery } from '@/test/render'
import CreateUserDialog from './CreateUserDialog'

vi.mock('axios')
const mockedAxios = vi.mocked(axios, true)

async function openDialog() {
  const user = userEvent.setup()
  renderWithQuery(<CreateUserDialog />)
  await user.click(screen.getByRole('button', { name: 'New User' }))
  return user
}

beforeEach(() => {
  vi.resetAllMocks()
})

describe('CreateUserDialog - form fields', () => {
  it('renders name, email and password fields', async () => {
    await openDialog()

    expect(screen.getByLabelText('Name')).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
  })
})

describe('CreateUserDialog - validation', () => {
  it('shows error when name is shorter than 3 characters', async () => {
    const user = await openDialog()

    await user.type(screen.getByLabelText('Name'), 'AB')
    await user.click(screen.getByRole('button', { name: 'Create' }))

    expect(await screen.findByText('Name must be at least 3 characters')).toBeInTheDocument()
  })

  it('shows error when email is invalid', async () => {
    const user = await openDialog()

    await user.type(screen.getByLabelText('Email'), 'not-an-email')
    await user.click(screen.getByRole('button', { name: 'Create' }))

    expect(await screen.findByText('Enter a valid email')).toBeInTheDocument()
  })

  it('shows error when password is shorter than 8 characters', async () => {
    const user = await openDialog()

    await user.type(screen.getByLabelText('Password'), '1234567')
    await user.click(screen.getByRole('button', { name: 'Create' }))

    expect(await screen.findByText('Password must be at least 8 characters')).toBeInTheDocument()
  })

  it('does not call POST when the form is invalid', async () => {
    const user = await openDialog()

    await user.click(screen.getByRole('button', { name: 'Create' }))

    expect(mockedAxios.post).not.toHaveBeenCalled()
  })
})

describe('CreateUserDialog - submission', () => {
  it('calls POST /api/users with the form values', async () => {
    mockedAxios.post.mockResolvedValue({ data: {} })
    const user = await openDialog()

    await user.type(screen.getByLabelText('Name'), 'Alice Smith')
    await user.type(screen.getByLabelText('Email'), 'alice@example.com')
    await user.type(screen.getByLabelText('Password'), 'securepass123')
    await user.click(screen.getByRole('button', { name: 'Create' }))

    await waitFor(() => {
      expect(mockedAxios.post).toHaveBeenCalledWith('/api/users', {
        name: 'Alice Smith',
        email: 'alice@example.com',
        password: 'securepass123',
      })
    })
  })

  it('closes the dialog after successful submission', async () => {
    mockedAxios.post.mockResolvedValue({ data: {} })
    const user = await openDialog()

    await user.type(screen.getByLabelText('Name'), 'Alice Smith')
    await user.type(screen.getByLabelText('Email'), 'alice@example.com')
    await user.type(screen.getByLabelText('Password'), 'securepass123')
    await user.click(screen.getByRole('button', { name: 'Create' }))

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })

  it('shows the server error message on failure', async () => {
    const err = Object.assign(new Error('Request failed'), {
      isAxiosError: true,
      response: { data: { error: 'Email already registered' } },
    })
    mockedAxios.post.mockRejectedValue(err)
    mockedAxios.isAxiosError.mockReturnValue(true)
    const user = await openDialog()

    await user.type(screen.getByLabelText('Name'), 'Alice Smith')
    await user.type(screen.getByLabelText('Email'), 'alice@example.com')
    await user.type(screen.getByLabelText('Password'), 'securepass123')
    await user.click(screen.getByRole('button', { name: 'Create' }))

    expect(await screen.findByText('Email already registered')).toBeInTheDocument()
  })

  it('keeps the dialog open after a server error', async () => {
    const err = Object.assign(new Error('Request failed'), {
      isAxiosError: true,
      response: { data: { error: 'Email already registered' } },
    })
    mockedAxios.post.mockRejectedValue(err)
    mockedAxios.isAxiosError.mockReturnValue(true)
    const user = await openDialog()

    await user.type(screen.getByLabelText('Name'), 'Alice Smith')
    await user.type(screen.getByLabelText('Email'), 'alice@example.com')
    await user.type(screen.getByLabelText('Password'), 'securepass123')
    await user.click(screen.getByRole('button', { name: 'Create' }))

    await screen.findByText('Email already registered')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})
