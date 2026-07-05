import { describe, it, expect, vi, beforeEach } from 'vitest'
import { handleInboundEmail } from './webhooks'

vi.mock('../lib/db', () => ({
  default: {
    ticket: { create: vi.fn() },
  },
}))

vi.mock('../queues/classifyTicket', () => ({
  queueTicketClassification: vi.fn(),
}))

vi.mock('../queues/autoResolveTicket', () => ({
  queueTicketAutoResolve: vi.fn(),
}))

import prisma from '../lib/db'
import { queueTicketClassification } from '../queues/classifyTicket'
import { queueTicketAutoResolve } from '../queues/autoResolveTicket'
const mockedCreate = vi.mocked(prisma.ticket.create)
const mockedQueueTicketClassification = vi.mocked(queueTicketClassification)
const mockedQueueTicketAutoResolve = vi.mocked(queueTicketAutoResolve)

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

beforeEach(() => {
  vi.resetAllMocks()
  process.env.WEBHOOK_SECRET = 'testsecret'
  mockedQueueTicketClassification.mockResolvedValue(undefined)
  mockedQueueTicketAutoResolve.mockResolvedValue(undefined)
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

  it('queues classification for the created ticket', async () => {
    const fakeTicket = { id: 'ticket-1', ...VALID_BODY, status: 'OPEN' }
    mockedCreate.mockResolvedValue(fakeTicket as any)
    const { req, res, next } = makeReqRes(VALID_HEADERS, VALID_BODY)

    await handleInboundEmail(req, res, next)

    expect(mockedQueueTicketClassification).toHaveBeenCalledWith({
      ticketId: 'ticket-1',
      subject: VALID_BODY.subject,
      body: VALID_BODY.body,
    })
  })

  it('does not throw when queueing classification fails', async () => {
    const fakeTicket = { id: 'ticket-1', ...VALID_BODY, status: 'OPEN' }
    mockedCreate.mockResolvedValue(fakeTicket as any)
    mockedQueueTicketClassification.mockRejectedValue(new Error('db unavailable'))
    const { req, res, next } = makeReqRes(VALID_HEADERS, VALID_BODY)

    await handleInboundEmail(req, res, next)

    expect(res.status).toHaveBeenCalledWith(201)
    expect(res.json).toHaveBeenCalledWith(fakeTicket)
  })

  it('queues auto-resolve for the created ticket', async () => {
    const fakeTicket = { id: 'ticket-1', ...VALID_BODY, status: 'OPEN' }
    mockedCreate.mockResolvedValue(fakeTicket as any)
    const { req, res, next } = makeReqRes(VALID_HEADERS, VALID_BODY)

    await handleInboundEmail(req, res, next)

    expect(mockedQueueTicketAutoResolve).toHaveBeenCalledWith({
      ticketId: 'ticket-1',
      subject: VALID_BODY.subject,
      body: VALID_BODY.body,
      from: VALID_BODY.from,
    })
  })

  it('does not throw when queueing auto-resolve fails', async () => {
    const fakeTicket = { id: 'ticket-1', ...VALID_BODY, status: 'OPEN' }
    mockedCreate.mockResolvedValue(fakeTicket as any)
    mockedQueueTicketAutoResolve.mockRejectedValue(new Error('db unavailable'))
    const { req, res, next } = makeReqRes(VALID_HEADERS, VALID_BODY)

    await handleInboundEmail(req, res, next)

    expect(res.status).toHaveBeenCalledWith(201)
    expect(res.json).toHaveBeenCalledWith(fakeTicket)
  })
})
