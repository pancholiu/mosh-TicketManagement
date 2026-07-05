import { RequestHandler } from 'express'
import { z } from 'zod'
import { google } from '@ai-sdk/google'
import { generateText, Output } from 'ai'
import { Category } from '@prisma/client'
import prisma from '../lib/db'

const inboundEmailSchema = z.object({
  from: z.string().email('Invalid sender email'),
  subject: z.string().min(1, 'Subject is required'),
  body: z.string().min(1, 'Body is required'),
})

// Fire-and-forget: classification must not delay the webhook response. Errors
// are swallowed since there's no request left to report them to — the ticket
// simply keeps category: null if classification fails.
async function classifyTicket(ticketId: string, subject: string, body: string) {
  try {
    const { output } = await generateText({
      model: google('gemini-2.5-flash'),
      output: Output.choice({ options: Object.values(Category) }),
      prompt: `Classify the following support ticket into exactly one category.

Subject: ${subject}
Body: ${body}`,
    })
    await prisma.ticket.update({ where: { id: ticketId }, data: { category: output } })
  } catch (error) {
    console.error(`Failed to classify ticket ${ticketId}:`, error)
  }
}

export const handleInboundEmail: RequestHandler = async (req, res) => {
  const authHeader = req.headers['authorization'] ?? ''
  if (authHeader !== `Bearer ${process.env.WEBHOOK_SECRET}`) {
    res.status(401).json({ error: 'Unauthorized' }); return
  }

  const parsed = inboundEmailSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0].message }); return
  }

  const { from, subject, body } = parsed.data
  const ticket = await prisma.ticket.create({ data: { from, subject, body } })
  res.status(201).json(ticket)

  void classifyTicket(ticket.id, subject, body)
}
