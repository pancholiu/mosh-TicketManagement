import { Role } from "@prisma/client"
import { auth } from "../server/src/lib/auth"
import prisma from "../server/src/lib/db"

const email = process.env.ADMIN_EMAIL
const password = process.env.ADMIN_PASSWORD

if (!email || !password) {
  console.error("ADMIN_EMAIL and ADMIN_PASSWORD must be set in .env")
  process.exit(1)
}

const ctx = await auth.$context

const existing = await ctx.internalAdapter.findUserByEmail(email)
if (existing) {
  console.log(`User ${email} already exists, skipping.`)
  process.exit(0)
}

const hashedPassword = await ctx.password.hash(password)

const user = await ctx.internalAdapter.createUser({
  name: "Admin",
  email,
  emailVerified: false,
  image: null,
})

await ctx.internalAdapter.createAccount({
  userId: user.id,
  accountId: email,
  providerId: "credential",
  password: hashedPassword,
})

await prisma.user.update({
  where: { id: user.id },
  data: { role: Role.ADMIN },
})

console.log(`Admin user created: ${email}`)
process.exit(0)
