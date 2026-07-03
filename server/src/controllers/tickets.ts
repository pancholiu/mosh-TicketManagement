import { RequestHandler } from 'express'
import { z } from 'zod'
import prisma from '../lib/db'

const listTicketsQuerySchema = z.object({
  sortBy: z.enum(['subject', 'from', 'status', 'category', 'createdAt']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
})

export const listTickets: RequestHandler = async (req, res) => {
  const parsed = listTicketsQuerySchema.safeParse(req.query)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0].message })
    return
  }
  const { sortBy, sortOrder } = parsed.data

  const tickets = await prisma.ticket.findMany({
    select: {
      id: true,
      subject: true,
      from: true,
      status: true,
      category: true,
      createdAt: true,
    },
    orderBy: { [sortBy]: sortOrder },
  })
  res.json(tickets)
}
