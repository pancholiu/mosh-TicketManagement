import path from 'path'
import { fileURLToPath } from 'url'
import express, { NextFunction, Request, Response } from 'express'
import * as Sentry from '@sentry/node'
import cors from 'cors'
import rateLimit from 'express-rate-limit'
import { toNodeHandler } from 'better-auth/node'
import { auth } from './lib/auth'
import { requireAuth, requireRole } from './middleware/auth'
import usersRouter from './routes/users'
import ticketsRouter from './routes/tickets'
import webhooksRouter from './routes/webhooks'

const app = express()

// Lock CORS to the known client origin — never use a wildcard with credentials.
app.use(cors({
  origin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
}))

if (process.env.NODE_ENV === 'production') {
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10,
    message: { error: 'Too many login attempts, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
  })
  app.use('/api/auth/sign-in', authLimiter)
}

app.all('/api/auth/*', toNodeHandler(auth))
app.use(express.json())

app.use('/webhooks', webhooksRouter)
app.use('/api/tickets', requireAuth, ticketsRouter)
app.use('/api/users', requireAuth, requireRole('ADMIN'), usersRouter)

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' })
})

if (process.env.NODE_ENV === 'production') {
  const clientDist = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../client/dist')
  app.use(express.static(clientDist))
  // SPA fallback: anything that isn't an API/webhook route gets index.html
  // so React Router can handle client-side paths on a full page load.
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/webhooks') || req.path === '/health') {
      next(); return
    }
    res.sendFile(path.join(clientDist, 'index.html'))
  })
}

Sentry.setupExpressErrorHandler(app)

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  const status = err.status ?? err.statusCode ?? 500
  const message = err.body?.message ?? err.message ?? 'Internal server error'
  res.status(status).json({ error: message })
})

export default app
