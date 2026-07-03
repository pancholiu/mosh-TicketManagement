import { Router } from 'express'
import { assignTicket, getTicket, listAssignees, listTickets } from '../controllers/tickets'

const router = Router()

router.get('/', listTickets)
router.get('/assignees', listAssignees)
router.get('/:id', getTicket)
router.patch('/:id/assign', assignTicket)

export default router
