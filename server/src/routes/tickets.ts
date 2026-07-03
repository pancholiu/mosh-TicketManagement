import { Router } from 'express'
import { getTicket, listTickets } from '../controllers/tickets'

const router = Router()

router.get('/', listTickets)
router.get('/:id', getTicket)

export default router
