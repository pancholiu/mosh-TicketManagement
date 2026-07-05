import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../lib/db', () => ({
  default: {
    ticket: { update: vi.fn() },
    reply: { create: vi.fn() },
    $transaction: vi.fn(),
  },
}))

vi.mock('../lib/queue', () => ({
  default: {
    send: vi.fn(),
    createQueue: vi.fn(),
    work: vi.fn(),
  },
}))

vi.mock('ai', () => ({
  generateText: vi.fn(),
  Output: { object: vi.fn((config) => config) },
}))

vi.mock('@ai-sdk/google', () => ({
  google: vi.fn((modelName: string) => modelName),
}))

vi.mock('node:fs', () => ({
  readFileSync: vi.fn(() => '# Fake Knowledge Base\n\nEscalation Rules: escalate chargebacks.'),
}))

vi.mock('../controllers/tickets', () => ({
  deriveCustomerName: vi.fn(() => 'Jane Doe'),
}))

import prisma from '../lib/db'
import boss from '../lib/queue'
import { generateText } from 'ai'
import { readFileSync } from 'node:fs'
import { SenderType, TicketStatus } from '@prisma/client'
import {
  AUTO_RESOLVE_TICKET_QUEUE,
  queueTicketAutoResolve,
  registerAutoResolveTicketWorker,
} from './autoResolveTicket'

const mockedUpdate = vi.mocked(prisma.ticket.update)
const mockedReplyCreate = vi.mocked(prisma.reply.create)
const mockedTransaction = vi.mocked(prisma.$transaction)
const mockedSend = vi.mocked(boss.send)
const mockedCreateQueue = vi.mocked(boss.createQueue)
const mockedWork = vi.mocked(boss.work)
const mockedGenerateText = vi.mocked(generateText)
const mockedReadFileSync = vi.mocked(readFileSync)

const JOB_DATA = {
  ticketId: 'ticket-1',
  subject: 'Forgot my password',
  body: 'I cannot log in, forgot my password.',
  from: 'jane.doe@example.com',
}

beforeEach(() => {
  vi.resetAllMocks()
  mockedReadFileSync.mockReturnValue('# Fake Knowledge Base\n\nEscalation Rules: escalate chargebacks.' as any)
  mockedTransaction.mockResolvedValue(undefined as any)
})

describe('queueTicketAutoResolve', () => {
  it('sends a job to the auto-resolve-ticket queue with the ticket data', async () => {
    await queueTicketAutoResolve(JOB_DATA)
    expect(mockedSend).toHaveBeenCalledWith(AUTO_RESOLVE_TICKET_QUEUE, JOB_DATA)
  })
})

describe('registerAutoResolveTicketWorker', () => {
  it('creates the queue and registers a worker for it', async () => {
    await registerAutoResolveTicketWorker()
    expect(mockedCreateQueue).toHaveBeenCalledWith(AUTO_RESOLVE_TICKET_QUEUE)
    expect(mockedWork).toHaveBeenCalledWith(AUTO_RESOLVE_TICKET_QUEUE, expect.any(Function))
  })
})

describe('auto-resolve-ticket job handler', () => {
  async function runHandler(data: typeof JOB_DATA) {
    await registerAutoResolveTicketWorker()
    const handler = mockedWork.mock.calls[0][1] as (jobs: Array<{ data: typeof JOB_DATA }>) => Promise<void>
    await handler([{ data }])
  }

  it('sets the ticket to PROCESSING before calling the AI', async () => {
    mockedGenerateText.mockResolvedValue({ output: { canResolve: false } } as any)

    await runHandler(JOB_DATA)

    expect(mockedUpdate).toHaveBeenCalledWith({
      where: { id: JOB_DATA.ticketId },
      data: { status: TicketStatus.PROCESSING },
    })
  })

  it('builds a prompt containing the knowledge base and ticket details', async () => {
    mockedGenerateText.mockResolvedValue({ output: { canResolve: false } } as any)

    await runHandler(JOB_DATA)

    const { prompt } = mockedGenerateText.mock.calls[0][0] as { prompt: string }
    expect(prompt).toContain('Fake Knowledge Base')
    expect(prompt).toContain(JOB_DATA.subject)
    expect(prompt).toContain(JOB_DATA.body)
  })

  it('creates an AI reply and resolves the ticket when the AI can resolve it', async () => {
    mockedGenerateText.mockResolvedValue({
      output: { canResolve: true, reply: 'Here is how to reset your password...' },
    } as any)

    await runHandler(JOB_DATA)

    expect(mockedReplyCreate).toHaveBeenCalledWith({
      data: {
        ticketId: JOB_DATA.ticketId,
        body: 'Here is how to reset your password...',
        senderType: SenderType.AI,
      },
    })
    expect(mockedUpdate).toHaveBeenCalledWith({
      where: { id: JOB_DATA.ticketId },
      data: { status: TicketStatus.RESOLVED },
    })
    expect(mockedTransaction).toHaveBeenCalledTimes(1)
  })

  it('leaves the ticket OPEN with no reply when the AI cannot resolve it', async () => {
    mockedGenerateText.mockResolvedValue({ output: { canResolve: false } } as any)

    await runHandler(JOB_DATA)

    expect(mockedReplyCreate).not.toHaveBeenCalled()
    expect(mockedUpdate).toHaveBeenCalledWith({
      where: { id: JOB_DATA.ticketId },
      data: { status: TicketStatus.OPEN },
    })
  })

  it('falls back the ticket to OPEN and rethrows when the AI call fails', async () => {
    mockedGenerateText.mockRejectedValue(new Error('model unavailable'))

    await expect(runHandler(JOB_DATA)).rejects.toThrow('model unavailable')

    expect(mockedUpdate).toHaveBeenCalledWith({
      where: { id: JOB_DATA.ticketId },
      data: { status: TicketStatus.OPEN },
    })
    expect(mockedReplyCreate).not.toHaveBeenCalled()
  })
})
