import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../lib/db', () => ({
  default: {
    ticket: { update: vi.fn() },
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
  Output: { choice: vi.fn((options) => options) },
}))

vi.mock('@ai-sdk/google', () => ({
  google: vi.fn((modelName: string) => modelName),
}))

import prisma from '../lib/db'
import boss from '../lib/queue'
import { generateText } from 'ai'
import { Category } from '@prisma/client'
import {
  CLASSIFY_TICKET_QUEUE,
  queueTicketClassification,
  registerClassifyTicketWorker,
} from './classifyTicket'

const mockedUpdate = vi.mocked(prisma.ticket.update)
const mockedSend = vi.mocked(boss.send)
const mockedCreateQueue = vi.mocked(boss.createQueue)
const mockedWork = vi.mocked(boss.work)
const mockedGenerateText = vi.mocked(generateText)

const JOB_DATA = { ticketId: 'ticket-1', subject: 'Cannot reset password', body: 'Nothing happens when I click reset.' }

beforeEach(() => {
  vi.resetAllMocks()
})

describe('queueTicketClassification', () => {
  it('sends a job to the classify-ticket queue with the ticket data', async () => {
    await queueTicketClassification(JOB_DATA)
    expect(mockedSend).toHaveBeenCalledWith(CLASSIFY_TICKET_QUEUE, JOB_DATA)
  })
})

describe('registerClassifyTicketWorker', () => {
  it('creates the queue and registers a worker for it', async () => {
    await registerClassifyTicketWorker()
    expect(mockedCreateQueue).toHaveBeenCalledWith(CLASSIFY_TICKET_QUEUE)
    expect(mockedWork).toHaveBeenCalledWith(CLASSIFY_TICKET_QUEUE, expect.any(Function))
  })
})

describe('classify-ticket job handler', () => {
  async function runHandler(data: typeof JOB_DATA) {
    await registerClassifyTicketWorker()
    const handler = mockedWork.mock.calls[0][1] as (jobs: Array<{ data: typeof JOB_DATA }>) => Promise<void>
    await handler([{ data }])
  }

  it('classifies using a prompt built from the ticket subject and body', async () => {
    mockedGenerateText.mockResolvedValue({ output: Category.TECHNICAL_QUESTION } as any)

    await runHandler(JOB_DATA)

    expect(mockedGenerateText).toHaveBeenCalledTimes(1)
    const { prompt } = mockedGenerateText.mock.calls[0][0] as { prompt: string }
    expect(prompt).toContain(JOB_DATA.subject)
    expect(prompt).toContain(JOB_DATA.body)
  })

  it('updates the ticket with the classified category', async () => {
    mockedGenerateText.mockResolvedValue({ output: Category.REFUND_REQUEST } as any)

    await runHandler(JOB_DATA)

    expect(mockedUpdate).toHaveBeenCalledWith({
      where: { id: JOB_DATA.ticketId },
      data: { category: Category.REFUND_REQUEST },
    })
  })

  it('propagates errors so pg-boss can retry the job', async () => {
    mockedGenerateText.mockRejectedValue(new Error('model unavailable'))

    await expect(runHandler(JOB_DATA)).rejects.toThrow('model unavailable')
    expect(mockedUpdate).not.toHaveBeenCalled()
  })
})
