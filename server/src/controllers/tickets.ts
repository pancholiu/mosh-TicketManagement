import { RequestHandler } from 'express'
import { z } from 'zod'
import { Prisma, Category, TicketStatus, SenderType } from '@prisma/client'
import { google } from '@ai-sdk/google'
import { generateText } from 'ai'
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
      replies: {
        include: { author: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: 'asc' },
      },
    },
  })
  if (!ticket) {
    res.status(404).json({ error: 'Ticket not found' })
    return
  }
  res.json(ticket)
}

const updateTicketSchema = z
  .object({
    status: z.enum(TicketStatus).optional(),
    category: z.enum(Category).nullable().optional(),
  })
  .refine((data) => data.status !== undefined || data.category !== undefined, {
    message: 'At least one of status or category is required',
  })

export const updateTicket: RequestHandler<{ id: string }> = async (req, res) => {
  const parsed = updateTicketSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0].message })
    return
  }
  const { status, category } = parsed.data

  const ticket = await prisma.ticket.findUnique({ where: { id: req.params.id }, select: { id: true } })
  if (!ticket) {
    res.status(404).json({ error: 'Ticket not found' })
    return
  }

  const updated = await prisma.ticket.update({
    where: { id: req.params.id },
    data: {
      ...(status !== undefined && { status }),
      ...(category !== undefined && { category }),
    },
    include: {
      assignedTo: { select: { id: true, name: true, email: true } },
      replies: {
        include: { author: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: 'asc' },
      },
    },
  })

  res.json(updated)
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
    include: {
      assignedTo: { select: { id: true, name: true, email: true } },
      replies: {
        include: { author: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: 'asc' },
      },
    },
  })

  res.json(updated)
}

const createReplySchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, 'Reply cannot be empty')
    .max(2000, 'Reply must be 2000 characters or fewer'),
})

export const createReply: RequestHandler<{ id: string }> = async (req, res) => {
  const parsed = createReplySchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0].message })
    return
  }

  const ticket = await prisma.ticket.findUnique({ where: { id: req.params.id }, select: { id: true } })
  if (!ticket) {
    res.status(404).json({ error: 'Ticket not found' })
    return
  }

  const reply = await prisma.reply.create({
    data: {
      body: parsed.data.body,
      ticketId: req.params.id,
      senderType: SenderType.AGENT,
      authorId: res.locals.session.user.id,
    },
    include: { author: { select: { id: true, name: true, email: true } } },
  })

  res.status(201).json(reply)
}

const polishReplySchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, 'Reply cannot be empty')
    .max(2000, 'Reply must be 2000 characters or fewer'),
})

// Tickets only store the customer's email, not a display name — approximate one
// from the local part (e.g. "jane.doe@x.com" -> "Jane Doe") for the greeting.
function deriveCustomerName(email: string): string {
  return email
    .split('@')[0]
    .split(/[._+-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export const polishReply: RequestHandler<{ id: string }> = async (req, res) => {
  const parsed = polishReplySchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0].message })
    return
  }

  const ticket = await prisma.ticket.findUnique({
    where: { id: req.params.id },
    select: { subject: true, body: true, from: true },
  })
  if (!ticket) {
    res.status(404).json({ error: 'Ticket not found' })
    return
  }

  const agentName = res.locals.session.user.name
  const customerName = deriveCustomerName(ticket.from)

  const { text } = await generateText({
    model: google('gemini-2.5-flash'),
    prompt: `You are helping a support agent polish a draft reply to a customer support ticket.

Ticket subject: ${ticket.subject}
Customer's message: ${ticket.body}

Agent's draft reply:
"""
${parsed.data.body}
"""

Rewrite the draft to be clear, professional, and courteous, while preserving its meaning and intent. Do not add new information, facts, or commitments the draft doesn't already contain. Open the reply by addressing the customer by name: ${customerName}. End the reply with a signature closing (e.g. "Best regards,") signed with the agent's name: ${agentName}. If the draft already has a greeting or signature, replace them with these instead of duplicating them. Respond with only the polished reply text — no preamble, labels, or quotes.`,
  })

  res.json({ body: text.trim() })
}
