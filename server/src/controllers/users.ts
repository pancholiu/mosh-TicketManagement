import { RequestHandler } from 'express'
import { z } from 'zod'
import { Role } from '@prisma/client'
import { hashPassword } from 'better-auth/crypto'
import prisma from '../lib/db'
import { auth } from '../lib/auth'

const createUserSchema = z.object({
  name: z.string().trim().min(3, 'Name must be at least 3 characters'),
  email: z.string().email('Enter a valid email'),
  password: z.string().trim().min(8, 'Password must be at least 8 characters'),
})

const updateUserSchema = z.object({
  name: z.string().trim().min(3, 'Name must be at least 3 characters'),
  email: z.string().email('Enter a valid email'),
  password: z.string().trim().min(8, 'Password must be at least 8 characters').optional(),
})

export const listUsers: RequestHandler = async (_req, res) => {
  const users = await prisma.user.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  })
  res.json(users)
}

export const deleteUser: RequestHandler = async (req, res) => {
  const id = req.params.id as string
  const user = await prisma.user.findUnique({ where: { id }, select: { role: true } })
  if (!user) { res.status(404).json({ error: 'User not found' }); return }
  if (user.role === Role.ADMIN) { res.status(403).json({ error: 'Admin users cannot be deleted' }); return }
  await prisma.$transaction([
    prisma.user.update({ where: { id }, data: { deletedAt: new Date() } }),
    prisma.ticket.updateMany({ where: { assignedToId: id }, data: { assignedToId: null } }),
  ])
  res.status(204).end()
}

export const createUser: RequestHandler = async (req, res) => {
  const parsed = createUserSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0].message })
    return
  }

  const { name, email, password } = parsed.data

  const result = await auth.api.createUser({
    body: { name, email, password, data: { role: Role.AGENT } },
  })
  res.status(201).json(result.user)
}

export const updateUser: RequestHandler = async (req, res) => {
  const parsed = updateUserSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0].message })
    return
  }

  const { name, email, password } = parsed.data
  const id = req.params.id as string

  const user = await prisma.user.update({
    where: { id },
    data: { name, email },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
  })

  if (password) {
    const hashedPassword = await hashPassword(password)
    await prisma.account.updateMany({
      where: { userId: id, providerId: 'credential' },
      data: { password: hashedPassword },
    })
  }

  res.json(user)
}
