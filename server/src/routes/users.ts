import { Router } from 'express'
import { listUsers, createUser, updateUser } from '../controllers/users'

const router = Router()

router.get('/', listUsers)
router.post('/', createUser)
router.patch('/:id', updateUser)

export default router
