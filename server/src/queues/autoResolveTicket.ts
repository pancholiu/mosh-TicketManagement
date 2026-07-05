import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { google } from '@ai-sdk/google'
import { generateText, Output } from 'ai'
import { z } from 'zod'
import { SenderType, TicketStatus } from '@prisma/client'
import prisma from '../lib/db'
import boss from '../lib/queue'
import { deriveCustomerName } from '../controllers/tickets'

export const AUTO_RESOLVE_TICKET_QUEUE = 'auto-resolve-ticket'

export type AutoResolveTicketJobData = {
  ticketId: string
  subject: string
  body: string
  from: string
}

const KNOWLEDGE_BASE_PATH = join(dirname(fileURLToPath(import.meta.url)), '../../knowledge-base.md')

const resolutionSchema = z.object({
  canResolve: z.boolean(),
  reply: z.string().optional(),
})

export async function queueTicketAutoResolve(data: AutoResolveTicketJobData) {
  await boss.send(AUTO_RESOLVE_TICKET_QUEUE, data)
}

// A ticket is marked PROCESSING as soon as the AI starts working on it, and must never be left
// stranded there — PROCESSING (like NEW) is hidden from the default tickets list, so any failure
// here falls back to OPEN rather than leaving the ticket invisible to human agents.
async function autoResolveTicketHandler([job]: Array<{ data: AutoResolveTicketJobData }>) {
  const { ticketId, subject, body, from } = job.data

  await prisma.ticket.update({ where: { id: ticketId }, data: { status: TicketStatus.PROCESSING } })

  try {
    const knowledgeBase = readFileSync(KNOWLEDGE_BASE_PATH, 'utf-8')
    const customerName = deriveCustomerName(from)

    const { output } = await generateText({
      model: google('gemini-2.5-flash'),
      output: Output.object({ schema: resolutionSchema }),
      prompt: `You are an automated support assistant for Code with Mosh. Use ONLY the information in the knowledge base below to decide whether this support ticket can be resolved automatically, without a human agent.

Knowledge Base:
"""
${knowledgeBase}
"""

Ticket:
Subject: ${subject}
Body: ${body}

Follow the "Escalation Rules" section of the knowledge base exactly: if any condition listed there applies to this ticket, or if you are not confident the knowledge base fully and directly answers it, you must not resolve it automatically.

Respond with:
- canResolve: true only if the knowledge base directly and confidently answers this ticket and none of the escalation conditions apply. Otherwise false.
- reply: only when canResolve is true — a complete, courteous customer-facing email reply based strictly on the knowledge base. Do not invent information the knowledge base doesn't contain. Greet the customer by name (${customerName}) and sign off as "Code with Mosh Support Team".`,
    })

    if (output.canResolve && output.reply) {
      await prisma.$transaction([
        prisma.reply.create({
          data: { ticketId, body: output.reply, senderType: SenderType.AI },
        }),
        prisma.ticket.update({
          where: { id: ticketId },
          data: { status: TicketStatus.RESOLVED },
        }),
      ])
    } else {
      await prisma.ticket.update({ where: { id: ticketId }, data: { status: TicketStatus.OPEN } })
    }
  } catch (error) {
    await prisma.ticket.update({ where: { id: ticketId }, data: { status: TicketStatus.OPEN } })
    throw error
  }
}

export async function registerAutoResolveTicketWorker() {
  await boss.createQueue(AUTO_RESOLVE_TICKET_QUEUE)
  await boss.work<AutoResolveTicketJobData>(AUTO_RESOLVE_TICKET_QUEUE, autoResolveTicketHandler)
}
