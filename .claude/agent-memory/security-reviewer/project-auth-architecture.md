---
name: project-auth-architecture
description: Auth/authz architecture of this project — controls in place, gaps identified, hotspots to always check on new routes
metadata:
  type: project
---

Better Auth v1.6 handles sessions via HTTP-only cookies (library default). The session secret is in `.env` as `BETTER_AUTH_SECRET`.

## Controls in place
- `disableSignUp: true` prevents public registration — users must be seeded
- `input: false` on the `role` additionalField blocks clients from setting their own role
- `trustedOrigins` set to `CLIENT_ORIGIN` env var (not wildcard)
- Seed script validates env vars before running and uses Better Auth's own hasher

## Persistent gaps (as of commit 2dc1a91)
- CORS uses `app.use(cors())` with zero options — allows any origin with any method
- No auth middleware on any custom API route yet; pattern risk as routes are added
- AdminRoute/ProtectedRoute are client-side only — no server-side role enforcement
- `ADMIN_PASSWORD=password123` in `.env` — weak default credential
- `DATABASE_URL` has no `?sslmode=require`
- `BETTER_AUTH_SECRET` present in `.env` — confirm `.env` was never committed

## Hotspots to always check
- Every new Express route: confirm `auth.api.getSession()` middleware present
- Prisma queries taking user-supplied IDs: IDOR risk (no ownership scoping yet)
- Webhook handlers (future): must verify HMAC signatures
- AI prompt construction (future): must sanitize ticket content
