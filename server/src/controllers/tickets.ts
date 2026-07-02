import { RequestHandler } from 'express'
import prisma from '../lib/db'

export const listTickets: RequestHandler = async (_req, res) => {
  const tickets = await prisma.ticket.findMany({
    select: {
      id: true,
      subject: true,
      from: true,
      status: true,
      category: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  })
  res.json(tickets)
}
