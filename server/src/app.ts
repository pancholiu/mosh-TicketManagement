import express from 'express'
import cors from 'cors'
import rateLimit from 'express-rate-limit'
import { toNodeHandler } from 'better-auth/node'
import { auth } from './lib/auth'

const app = express()

// NOTE: '/api/auth' must come before the '/api' catch-all in any proxy config.
// Lock CORS to the known client origin — never use a wildcard with credentials.
app.use(cors({
  origin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
}))

// Rate-limit sign-in attempts to mitigate brute-force and credential stuffing.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: { error: 'Too many login attempts, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
})
app.use('/api/auth/sign-in', authLimiter)

app.all('/api/auth/*', toNodeHandler(auth))
app.use(express.json())

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' })
})

export default app
