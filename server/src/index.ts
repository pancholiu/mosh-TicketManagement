import app from './app'

// Fail fast if required secrets are absent — a missing secret would allow
// Better Auth to fall back to a weak or empty signing key.
if (!process.env.BETTER_AUTH_SECRET || process.env.BETTER_AUTH_SECRET.length < 32) {
  console.error(
    'FATAL: BETTER_AUTH_SECRET is missing or too short (minimum 32 characters). ' +
    'Generate one with: openssl rand -base64 32'
  )
  process.exit(1)
}

const PORT = process.env.PORT ?? 3000

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})
