import { Router } from 'express'
import { listTickets } from '../controllers/tickets'

const router = Router()

router.get('/', listTickets)

export default router
