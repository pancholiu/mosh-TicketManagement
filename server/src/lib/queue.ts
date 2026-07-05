import { PgBoss } from 'pg-boss'

const boss = new PgBoss({ connectionString: process.env.DATABASE_URL! })

boss.on('error', (error: Error) => console.error('pg-boss error:', error))

export default boss
