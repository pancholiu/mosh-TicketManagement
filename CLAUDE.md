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
- **Frontend:** React 19, TypeScript, Tailwind CSS v4, React Router v7, shadcn/ui (default style)
- **Backend:** Express 4, TypeScript
- **Database:** PostgreSQL via Prisma ORM
- **Auth:** Better Auth v1.6
- **AI:** Anthropic Claude API
- **Email:** SendGrid or Mailgun (inbound webhook + outbound send)
- **Deployment:** Docker + cloud provider (Railway / Fly.io)

## Running the App

> **OneDrive note:** This project lives inside OneDrive. Bun v1.3.14 cannot create hardlinks from its global cache into OneDrive directories, which silently breaks package resolution. Always use `--cache-dir "C:\bun-cache"` (outside OneDrive).

```powershell
# Install dependencies (from root) — cache-dir flag is required
bun install --cache-dir "C:\bun-cache"

# Generate Prisma client (after first install or schema changes)
bunx prisma generate

# Start both servers (from root)
bun run dev
```

`bun run dev` expands to `bun run --filter '*' dev`, which runs the `dev` script in each workspace concurrently. Do NOT run workspaces individually with `cd server && bun --watch ...` — workspace-level `node_modules` resolution is broken on this OneDrive setup; run from root only.

Vite proxies `/api/*` → `http://localhost:3000` (strips `/api` prefix), so frontend fetches use `/api/...`.

## Testing

Use the **playwright-e2e-writer** agent to write E2E tests. Invoke it after any significant feature or page is built. It knows the project's test setup, seeded credentials, and Playwright conventions — do not write E2E tests manually without it.

```powershell
bun run test:e2e       # headless
bun run test:e2e:ui    # interactive UI
```

## Key Conventions

- Server entry: `server/src/index.ts` → imports `app.ts`, binds to `PORT`
- Client entry: `client/src/main.tsx` → wraps `<App>` in `<BrowserRouter>`
- Tailwind v4: no config file — import with `@import "tailwindcss"` in CSS; theme tokens in `client/src/index.css` via `@theme inline`
- Path alias: `@` maps to `client/src/` (configured in both `tsconfig.app.json` and `vite.config.ts`)
- shadcn/ui: `default` style, zinc-based palette, `cssVariables: true`; add components with `npx shadcn@latest add <component>` from `client/`
- Environment variables: copy `.env.example` → `.env` in project root
- **Workspace package resolution quirk:** server deps (`express`, `cors`, `better-auth`) are listed in root `package.json` (not just `server/package.json`) so Bun's resolver can find them from the root context
