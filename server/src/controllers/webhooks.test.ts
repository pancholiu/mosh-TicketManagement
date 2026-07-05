import { describe, it, expect, vi, beforeEach } from 'vitest'
import { handleInboundEmail } from './webhooks'

vi.mock('../lib/db', () => ({
  default: {
    ticket: { create: vi.fn(), update: vi.fn() },
  },
}))

vi.mock('ai', () => ({
  generateText: vi.fn(),
  Output: { choice: vi.fn((options) => options) },
}))

vi.mock('@ai-sdk/google', () => ({
  google: vi.fn((modelName: string) => modelName),
}))

import prisma from '../lib/db'
import { generateText } from 'ai'
import { Category } from '@prisma/client'
const mockedCreate = vi.mocked(prisma.ticket.create)
const mockedUpdate = vi.mocked(prisma.ticket.update)
const mockedGenerateText = vi.mocked(generateText)

const VALID_HEADERS = { authorization: 'Bearer testsecret' }
const VALID_BODY = { from: 'john@example.com', subject: 'Help needed', body: 'I need help.' }

function makeReqRes(headers: Record<string, string> = {}, body: object = {}) {
  const req = { headers, body } as any
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    end: vi.fn().mockReturnThis(),
  } as any
  const next = vi.fn()
  return { req, res, next }
}

// Classification runs fire-and-forget after the response is sent; flush
// microtasks so its promise settles before assertions run.
function flushMicrotasks() {
  return new Promise((resolve) => setImmediate(resolve))
}

beforeEach(() => {
  vi.resetAllMocks()
  process.env.WEBHOOK_SECRET = 'testsecret'
  mockedGenerateText.mockResolvedValue({ output: Category.GENERAL_QUESTION } as any)
})

describe('handleInboundEmail - auth', () => {
  it('returns 401 when Authorization header is missing', async () => {
    const { req, res, next } = makeReqRes({}, VALID_BODY)
    await handleInboundEmail(req, res, next)
    expect(res.status).toHaveBeenCalledWith(401)
    expect(res.json).toHaveBeenCalledWith({ error: 'Unauthorized' })
  })

  it('returns 401 when Authorization header has the wrong secret', async () => {
    const { req, res, next } = makeReqRes({ authorization: 'Bearer wrongsecret' }, VALID_BODY)
    await handleInboundEmail(req, res, next)
    expect(res.status).toHaveBeenCalledWith(401)
    expect(res.json).toHaveBeenCalledWith({ error: 'Unauthorized' })
  })

  it('does not call prisma.ticket.create on auth failure', async () => {
    const { req, res, next } = makeReqRes({}, VALID_BODY)
    await handleInboundEmail(req, res, next)
    expect(mockedCreate).not.toHaveBeenCalled()
  })
})

describe('handleInboundEmail - validation', () => {
  it('returns 400 when from is not a valid email', async () => {
    const { req, res, next } = makeReqRes(VALID_HEADERS, { ...VALID_BODY, from: 'not-an-email' })
    await handleInboundEmail(req, res, next)
    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid sender email' })
  })

  it('returns 400 when subject is empty', async () => {
    const { req, res, next } = makeReqRes(VALID_HEADERS, { ...VALID_BODY, subject: '' })
    await handleInboundEmail(req, res, next)
    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({ error: 'Subject is required' })
  })

  it('returns 400 when body is empty', async () => {
    const { req, res, next } = makeReqRes(VALID_HEADERS, { ...VALID_BODY, body: '' })
    await handleInboundEmail(req, res, next)
    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({ error: 'Body is required' })
  })

  it('does not call prisma.ticket.create on validation failure', async () => {
    const { req, res, next } = makeReqRes(VALID_HEADERS, { ...VALID_BODY, from: 'bad' })
    await handleInboundEmail(req, res, next)
    expect(mockedCreate).not.toHaveBeenCalled()
  })
})

describe('handleInboundEmail - success', () => {
  it('calls prisma.ticket.create with the parsed fields', async () => {
    const fakeTicket = { id: 'ticket-1', ...VALID_BODY, status: 'OPEN' }
    mockedCreate.mockResolvedValue(fakeTicket as any)
    const { req, res, next } = makeReqRes(VALID_HEADERS, VALID_BODY)

    await handleInboundEmail(req, res, next)

    expect(mockedCreate).toHaveBeenCalledWith({
      data: { from: 'john@example.com', subject: 'Help needed', body: 'I need help.' },
    })
  })

  it('returns 201 with the created ticket', async () => {
    const fakeTicket = { id: 'ticket-1', ...VALID_BODY, status: 'OPEN' }
    mockedCreate.mockResolvedValue(fakeTicket as any)
    const { req, res, next } = makeReqRes(VALID_HEADERS, VALID_BODY)

    await handleInboundEmail(req, res, next)

    expect(res.status).toHaveBeenCalledWith(201)
    expect(res.json).toHaveBeenCalledWith(fakeTicket)
  })

  it('responds before classification finishes (non-blocking)', async () => {
    const fakeTicket = { id: 'ticket-1', ...VALID_BODY, status: 'OPEN' }
    mockedCreate.mockResolvedValue(fakeTicket as any)
    let resolveGenerateText!: (value: unknown) => void
    mockedGenerateText.mockReturnValue(
      new Promise((resolve) => {
        resolveGenerateText = resolve
      }) as any
    )
    const { req, res, next } = makeReqRes(VALID_HEADERS, VALID_BODY)

    await handleInboundEmail(req, res, next)

    expect(res.status).toHaveBeenCalledWith(201)
    expect(mockedUpdate).not.toHaveBeenCalled()

    resolveGenerateText({ output: Category.GENERAL_QUESTION })
    await flushMicrotasks()
  })
})

describe('handleInboundEmail - classification', () => {
  it('classifies the ticket using the subject and body', async () => {
    const fakeTicket = { id: 'ticket-1', ...VALID_BODY, status: 'OPEN' }
    mockedCreate.mockResolvedValue(fakeTicket as any)
    mockedGenerateText.mockResolvedValue({ output: Category.TECHNICAL_QUESTION } as any)
    const { req, res, next } = makeReqRes(VALID_HEADERS, VALID_BODY)

    await handleInboundEmail(req, res, next)
    await flushMicrotasks()

    expect(mockedGenerateText).toHaveBeenCalledTimes(1)
    const { prompt } = mockedGenerateText.mock.calls[0][0] as { prompt: string }
    expect(prompt).toContain(VALID_BODY.subject)
    expect(prompt).toContain(VALID_BODY.body)
  })

  it('updates the ticket with the classified category', async () => {
    const fakeTicket = { id: 'ticket-1', ...VALID_BODY, status: 'OPEN' }
    mockedCreate.mockResolvedValue(fakeTicket as any)
    mockedGenerateText.mockResolvedValue({ output: Category.REFUND_REQUEST } as any)
    const { req, res, next } = makeReqRes(VALID_HEADERS, VALID_BODY)

    await handleInboundEmail(req, res, next)
    await flushMicrotasks()

    expect(mockedUpdate).toHaveBeenCalledWith({
      where: { id: 'ticket-1' },
      data: { category: Category.REFUND_REQUEST },
    })
  })

  it('does not throw when classification fails', async () => {
    const fakeTicket = { id: 'ticket-1', ...VALID_BODY, status: 'OPEN' }
    mockedCreate.mockResolvedValue(fakeTicket as any)
    mockedGenerateText.mockRejectedValue(new Error('model unavailable'))
    const { req, res, next } = makeReqRes(VALID_HEADERS, VALID_BODY)

    await handleInboundEmail(req, res, next)
    await flushMicrotasks()

    expect(res.status).toHaveBeenCalledWith(201)
    expect(mockedUpdate).not.toHaveBeenCalled()
  })
})
