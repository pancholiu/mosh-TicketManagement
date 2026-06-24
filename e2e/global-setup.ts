import { execSync } from 'child_process'
import * as dotenv from 'dotenv'
import * as path from 'path'

export default async function globalSetup() {
  // Load test env so DATABASE_URL points at ticketdb_test during setup
  dotenv.config({ path: path.join(process.cwd(), '.env.test'), override: true })

  // Apply all pending migrations to the test database
  execSync('bunx prisma migrate deploy', {
    stdio: 'inherit',
    env: { ...process.env },
  })
}
