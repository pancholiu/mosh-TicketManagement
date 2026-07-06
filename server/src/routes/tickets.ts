import { Router } from 'express'
import {
  assignTicket,
  createReply,
  getTicket,
  getTicketStats,
  listAssignees,
  listTickets,
  polishReply,
  summarizeTicket,
  updateTicket,
} from '../controllers/tickets'

const router = Router()

router.get('/', listTickets)
router.get('/assignees', listAssignees)
router.get('/stats', getTicketStats)
router.get('/:id', getTicket)
router.patch('/:id', updateTicket)
router.patch('/:id/assign', assignTicket)
router.post('/:id/replies', createReply)
router.post('/:id/polish-reply', polishReply)
router.post('/:id/summarize', summarizeTicket)

export default router
