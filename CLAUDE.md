# Ticket Management — Project Memory

## Documentation

Always use **context7** (`mcp__context7__resolve-library-id` + `mcp__context7__query-docs`) to fetch up-to-date documentation before using any library or framework. Never rely on training-data knowledge for API syntax, configuration, or version-specific behavior.

Libraries in use that must be looked up via context7 before touching:

| Library | context7 ID |
|---|---|
| Bun | `/oven-sh/bun` |
| Vite | `/vitejs/vite` |
| Express | `/expressjs/express` |
| Prisma | resolve at query time |
| React Router | resolve at query time |
| Tailwind CSS | resolve at query time |
| Anthropic SDK | resolve at query time |

## Project

AI-powered ticket management system for handling support emails. Agents read, classify, and respond to tickets. Claude API provides automatic classification, summaries, and suggested replies.

See `project-scope.md` for full feature list and `implementation-plan.md` for the phased task breakdown.

## Structure

```
mosh-TicketManagement/
├── client/        React + TypeScript + Vite + Tailwind CSS v4
├── server/        Express + TypeScript, runs on Bun
└── prisma/        (upcoming) Prisma schema and migrations
```

## Tech Stack

- **Runtime:** Bun (server) + Vite dev server (client)
- **Frontend:** React 19, TypeScript, Tailwind CSS v4, React Router v7
- **Backend:** Express 4, TypeScript
- **Database:** PostgreSQL via Prisma ORM
- **Auth:** express-session with PostgreSQL session store
- **AI:** Anthropic Claude API
- **Email:** SendGrid or Mailgun (inbound webhook + outbound send)
- **Deployment:** Docker + cloud provider (Railway / Fly.io)

## Running the App

```bash
# Install dependencies (from root)
bun install

# Start both servers concurrently (from root)
bun run dev

# Or individually:
cd server && bun --watch src/index.ts   # http://localhost:3000
cd client && bun run dev                # http://localhost:5173
```

Vite proxies `/api/*` → `http://localhost:3000` (strips `/api` prefix), so frontend fetches use `/api/...`.

## Key Conventions

- Server entry: `server/src/index.ts` → imports `app.ts`, binds to `PORT`
- Client entry: `client/src/main.tsx` → wraps `<App>` in `<BrowserRouter>`
- Tailwind v4: no config file — import with `@import "tailwindcss"` in CSS
- Environment variables: copy `.env.example` → `.env` in project root
