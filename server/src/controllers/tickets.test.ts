import { describe, it, expect, vi, beforeEach } from 'vitest'
import { polishReply, summarizeTicket } from './tickets'

vi.mock('../lib/db', () => ({
  default: {
    ticket: { findUnique: vi.fn() },
  },
}))

vi.mock('ai', () => ({
  generateText: vi.fn(),
}))

vi.mock('@ai-sdk/google', () => ({
  google: vi.fn((modelName: string) => modelName),
}))

import prisma from '../lib/db'
import { generateText } from 'ai'

const mockedFindUnique = vi.mocked(prisma.ticket.findUnique)
const mockedGenerateText = vi.mocked(generateText)

const TICKET_ID = 't1'
const FAKE_TICKET = {
  subject: 'Cannot reset password',
  body: 'I clicked the reset link but nothing happens.',
  from: 'jane.doe@example.com',
}

function makeReqRes(body: object = {}, agent: { id: string; name: string } = { id: 'u1', name: 'Jamie Rivera' }) {
  const req = { params: { id: TICKET_ID }, body } as any
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    locals: { session: { user: agent } },
  } as any
  const next = vi.fn()
  return { req, res, next }
}

beforeEach(() => {
  vi.resetAllMocks()
})

describe('polishReply - validation', () => {
  it('returns 400 when body is empty', async () => {
    const { req, res } = makeReqRes({ body: '' })
    await polishReply(req, res, vi.fn())
    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({ error: 'Reply cannot be empty' })
  })

  it('returns 400 when body is whitespace-only', async () => {
    const { req, res } = makeReqRes({ body: '   ' })
    await polishReply(req, res, vi.fn())
    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({ error: 'Reply cannot be empty' })
  })

  it('returns 400 when body exceeds 2000 characters', async () => {
    const { req, res } = makeReqRes({ body: 'a'.repeat(2001) })
    await polishReply(req, res, vi.fn())
    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({ error: 'Reply must be 2000 characters or fewer' })
  })

  it('does not look up the ticket or call generateText on validation failure', async () => {
    const { req, res } = makeReqRes({ body: '' })
    await polishReply(req, res, vi.fn())
    expect(mockedFindUnique).not.toHaveBeenCalled()
    expect(mockedGenerateText).not.toHaveBeenCalled()
  })
})

describe('polishReply - ticket lookup', () => {
  it('returns 404 when the ticket does not exist', async () => {
    mockedFindUnique.mockResolvedValue(null)
    const { req, res } = makeReqRes({ body: 'looking into it' })

    await polishReply(req, res, vi.fn())

    expect(res.status).toHaveBeenCalledWith(404)
    expect(res.json).toHaveBeenCalledWith({ error: 'Ticket not found' })
    expect(mockedGenerateText).not.toHaveBeenCalled()
  })
})

describe('polishReply - success', () => {
  it('calls generateText with a prompt containing the ticket context, draft, customer name and agent name', async () => {
    mockedFindUnique.mockResolvedValue(FAKE_TICKET as any)
    mockedGenerateText.mockResolvedValue({ text: 'Polished reply text' } as any)
    const { req, res } = makeReqRes(
      { body: 'looking into it' },
      { id: 'u1', name: 'Jamie Rivera' }
    )

    await polishReply(req, res, vi.fn())

    expect(mockedGenerateText).toHaveBeenCalledTimes(1)
    const { prompt } = mockedGenerateText.mock.calls[0][0] as { prompt: string }
    expect(prompt).toContain(FAKE_TICKET.subject)
    expect(prompt).toContain(FAKE_TICKET.body)
    expect(prompt).toContain('looking into it')
    expect(prompt).toContain('Jane Doe')
    expect(prompt).toContain('Jamie Rivera')
  })

  it('responds with the trimmed generated text', async () => {
    mockedFindUnique.mockResolvedValue(FAKE_TICKET as any)
    mockedGenerateText.mockResolvedValue({ text: '  Polished reply text  \n' } as any)
    const { req, res } = makeReqRes({ body: 'looking into it' })

    await polishReply(req, res, vi.fn())

    expect(res.json).toHaveBeenCalledWith({ body: 'Polished reply text' })
  })

  it.each([
    ['jane.doe@example.com', 'Jane Doe'],
    ['john_smith@example.com', 'John Smith'],
    ['first-last@example.com', 'First Last'],
    ['support@example.com', 'Support'],
  ])('derives the customer name %s -> %s', async (email, expectedName) => {
    mockedFindUnique.mockResolvedValue({ ...FAKE_TICKET, from: email } as any)
    mockedGenerateText.mockResolvedValue({ text: 'Polished reply text' } as any)
    const { req, res } = makeReqRes({ body: 'looking into it' })

    await polishReply(req, res, vi.fn())

    const { prompt } = mockedGenerateText.mock.calls[0][0] as { prompt: string }
    expect(prompt).toContain(expectedName)
  })
})

describe('summarizeTicket - ticket lookup', () => {
  it('returns 404 when the ticket does not exist', async () => {
    mockedFindUnique.mockResolvedValue(null)
    const { req, res } = makeReqRes()

    await summarizeTicket(req, res, vi.fn())

    expect(res.status).toHaveBeenCalledWith(404)
    expect(res.json).toHaveBeenCalledWith({ error: 'Ticket not found' })
    expect(mockedGenerateText).not.toHaveBeenCalled()
  })
})

describe('summarizeTicket - success', () => {
  const FAKE_TICKET_WITH_REPLIES = {
    ...FAKE_TICKET,
    replies: [
      { body: 'Have you tried clearing your cache?', senderType: 'AGENT', author: { name: 'Jamie Rivera' } },
      { body: 'Yes, still not working.', senderType: 'CUSTOMER', author: null },
    ],
  }

  it('calls generateText with a prompt containing the ticket context and conversation history', async () => {
    mockedFindUnique.mockResolvedValue(FAKE_TICKET_WITH_REPLIES as any)
    mockedGenerateText.mockResolvedValue({ text: 'Summary text' } as any)
    const { req, res } = makeReqRes()

    await summarizeTicket(req, res, vi.fn())

    expect(mockedGenerateText).toHaveBeenCalledTimes(1)
    const { prompt } = mockedGenerateText.mock.calls[0][0] as { prompt: string }
    expect(prompt).toContain(FAKE_TICKET.subject)
    expect(prompt).toContain(FAKE_TICKET.body)
    expect(prompt).toContain('Jamie Rivera: Have you tried clearing your cache?')
    expect(prompt).toContain('Jane Doe: Yes, still not working.')
  })

  it('handles tickets with no replies yet', async () => {
    mockedFindUnique.mockResolvedValue({ ...FAKE_TICKET, replies: [] } as any)
    mockedGenerateText.mockResolvedValue({ text: 'Summary text' } as any)
    const { req, res } = makeReqRes()

    await summarizeTicket(req, res, vi.fn())

    const { prompt } = mockedGenerateText.mock.calls[0][0] as { prompt: string }
    expect(prompt).toContain('(No replies yet.)')
  })

  it('responds with the trimmed generated summary', async () => {
    mockedFindUnique.mockResolvedValue(FAKE_TICKET_WITH_REPLIES as any)
    mockedGenerateText.mockResolvedValue({ text: '  Summary text  \n' } as any)
    const { req, res } = makeReqRes()

    await summarizeTicket(req, res, vi.fn())

    expect(res.json).toHaveBeenCalledWith({ summary: 'Summary text' })
  })
})
