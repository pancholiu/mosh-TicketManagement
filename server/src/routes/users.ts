import { Router } from 'express'
import { listUsers, createUser, updateUser, deleteUser } from '../controllers/users'

const router = Router()

router.get('/', listUsers)
router.post('/', createUser)
router.patch('/:id', updateUser)
router.delete('/:id', deleteUser)

export default router
