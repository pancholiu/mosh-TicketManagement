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

export const listAssignees: RequestHandler = async (_req, res) => {
  const users = await prisma.user.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true, email: true, role: true },
    orderBy: { name: 'asc' },
  })
  res.json(users)
}

const assignTicketSchema = z.object({
  assignedToId: z.string().min(1).nullable(),
})

export const assignTicket: RequestHandler<{ id: string }> = async (req, res) => {
  const parsed = assignTicketSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0].message })
    return
  }
  const { assignedToId } = parsed.data

  const ticket = await prisma.ticket.findUnique({ where: { id: req.params.id }, select: { id: true } })
  if (!ticket) {
    res.status(404).json({ error: 'Ticket not found' })
    return
  }

  if (assignedToId) {
    const assignee = await prisma.user.findUnique({ where: { id: assignedToId }, select: { deletedAt: true } })
    if (!assignee || assignee.deletedAt) {
      res.status(400).json({ error: 'Assignee not found' })
      return
    }
  }

  const updated = await prisma.ticket.update({
    where: { id: req.params.id },
    data: { assignedToId },
    include: { assignedTo: { select: { id: true, name: true, email: true } } },
  })

  res.json(updated)
}
