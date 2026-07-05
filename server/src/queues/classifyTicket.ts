import { google } from '@ai-sdk/google'
import { generateText, Output } from 'ai'
import { Category } from '@prisma/client'
import prisma from '../lib/db'
import boss from '../lib/queue'

export const CLASSIFY_TICKET_QUEUE = 'classify-ticket'

export type ClassifyTicketJobData = {
  ticketId: string
  subject: string
  body: string
}

export async function queueTicketClassification(data: ClassifyTicketJobData) {
  await boss.send(CLASSIFY_TICKET_QUEUE, data)
}

// Failures are left to pg-boss's retry/dead-letter handling — the ticket
// simply keeps category: null if classification never succeeds.
async function classifyTicketHandler([job]: Array<{ data: ClassifyTicketJobData }>) {
  const { ticketId, subject, body } = job.data

  const { output } = await generateText({
    model: google('gemini-2.5-flash'),
    output: Output.choice({ options: Object.values(Category) }),
    prompt: `Classify the following support ticket into exactly one category.

Subject: ${subject}
Body: ${body}`,
  })

  await prisma.ticket.update({ where: { id: ticketId }, data: { category: output } })
}

export async function registerClassifyTicketWorker() {
  await boss.createQueue(CLASSIFY_TICKET_QUEUE)
  await boss.work<ClassifyTicketJobData>(CLASSIFY_TICKET_QUEUE, classifyTicketHandler)
}
