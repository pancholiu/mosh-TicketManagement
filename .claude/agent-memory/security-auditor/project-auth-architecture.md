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
- CORS uses `app.use(cors())` with zero options — allows any origin with any method. Must be locked down before any API routes are added.
- Zero API routes with auth middleware exist yet, but the pattern of adding routes without middleware is already present in `app.ts`. Every new route added to `app.ts` must get auth middleware explicitly — there is no catch-all guard.
- `AdminRoute` and `ProtectedRoute` are client-side only. The server has no `/api/users` or similar endpoint yet, but when those are added they need server-side role checks.
- `/api/auth/*` route pattern in Vite proxy is declared before `/api` catch-all, so auth routes are not double-handled.
- `.env` is git-ignored correctly; `.env.example` has empty secrets (correct pattern).
- `BETTER_AUTH_SECRET` in `.env` is a real base64 string — must be rotated if `.env` was ever committed.
- `ADMIN_PASSWORD=password123` in `.env` — weak default credential, must be changed before any shared/cloud deploy.
- `DATABASE_URL` uses non-SSL connection string — no `?sslmode=require` present.
- `db.ts` uses `process.env.DATABASE_URL!` with a non-null assertion — no runtime guard.

## Hotspots to always check when new code lands
- Every new Express route in `server/src/app.ts` or any new route file: confirm auth middleware is applied
- Any Prisma query that takes user-supplied IDs: check for IDOR (no ownership scoping yet)
- Webhook handlers (not yet implemented): must verify HMAC signatures
- AI prompt construction (not yet implemented): must sanitize ticket content before injecting into prompts

**Why:** Auth-only client-side guards are a systemic pattern risk in this codebase — the very first protected page (UsersPage) has no server-side enforcement.

**How to apply:** Flag any new route that doesn't call `auth.api.getSession()` or equivalent middleware as a HIGH finding automatically.
