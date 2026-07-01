import { RequestHandler } from 'express'
import { z } from 'zod'
import prisma from '../lib/db'

const inboundEmailSchema = z.object({
  from: z.string().email('Invalid sender email'),
  subject: z.string().min(1, 'Subject is required'),
  body: z.string().min(1, 'Body is required'),
})

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
}
