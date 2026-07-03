import { RequestHandler } from 'express'
import { z } from 'zod'
import { Prisma, Category, TicketStatus } from '@prisma/client'
import prisma from '../lib/db'

const listTicketsQuerySchema = z.object({
  sortBy: z.enum(['subject', 'from', 'status', 'category', 'createdAt']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  status: z.enum(TicketStatus).optional(),
  category: z.enum([...Object.values(Category), 'NONE']).optional(),
  search: z.string().trim().min(1).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
})

export const listTickets: RequestHandler = async (req, res) => {
  const parsed = listTicketsQuerySchema.safeParse(req.query)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0].message })
    return
  }
  const { sortBy, sortOrder, status, category, search, page, pageSize } = parsed.data

  const where: Prisma.TicketWhereInput = {
    status,
    category: category === 'NONE' ? null : category,
  }
  if (search) {
    where.OR = [
      { subject: { contains: search, mode: 'insensitive' } },
      { from: { contains: search, mode: 'insensitive' } },
    ]
  }

  const [tickets, total] = await Promise.all([
    prisma.ticket.findMany({
      where,
      select: {
        id: true,
        subject: true,
        from: true,
        status: true,
        category: true,
        createdAt: true,
      },
      orderBy: { [sortBy]: sortOrder },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.ticket.count({ where }),
  ])

  res.json({ data: tickets, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) })
}

export const getTicket: RequestHandler<{ id: string }> = async (req, res) => {
  const ticket = await prisma.ticket.findUnique({
    where: { id: req.params.id },
    include: {
      assignedTo: { select: { id: true, name: true, email: true } },
    },
  })
  if (!ticket) {
    res.status(404).json({ error: 'Ticket not found' })
    return
  }
  res.json(ticket)
}
