import { Router } from 'express'
import { handleInboundEmail } from '../controllers/webhooks'

const router = Router()
router.post('/email', handleInboundEmail)
export default router
