import express from 'express'
import cors from 'cors'
import { toNodeHandler } from 'better-auth/node'
import { auth } from './lib/auth'

const app = express()

app.use(cors())
app.all('/api/auth/*', toNodeHandler(auth))
app.use(express.json())

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' })
})

export default app
