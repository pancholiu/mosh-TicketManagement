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
- **Frontend:** React 19, TypeScript, Tailwind CSS v4, React Router v7, shadcn/ui (default style), Axios (HTTP), TanStack Query v5 (server state)
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

### Component tests (Vitest + React Testing Library)

Run from the `client/` directory (or via the workspace script):

```powershell
cd client
bunx vitest run        # single run
bunx vitest            # watch mode
```

**Setup:**
- Vitest configured in `client/vite.config.ts` (`environment: 'jsdom'`, `globals: true`)
- Setup file: `client/src/test/setup.ts` — imports `@testing-library/jest-dom`
- Shared render helper: `client/src/test/render.tsx` — exports `renderWithQuery(ui)` which wraps the component in a fresh `QueryClientProvider`

**Conventions:**
- Test files live next to the component they test: `SomePage.test.tsx` beside `SomePage.tsx`
- Mock Axios with `vi.mock('axios')` and `vi.mocked(axios, true)` — never mock `fetch`
- Use `renderWithQuery(<Component />)` for any component that calls `useQuery` or `useMutation`
- Always call `vi.resetAllMocks()` in `beforeEach`
- Test IDs are not used — query by role, text, and label (`getByRole`, `findByText`, etc.)

### E2E tests (Playwright)

Use the **playwright-e2e-writer** agent to write E2E tests. Invoke it after any significant feature or page is built. It knows the project's test setup, seeded credentials, and Playwright conventions — do not write E2E tests manually without it.

```powershell
bun run test:e2e       # headless
bun run test:e2e:ui    # interactive UI
```

**Scope E2E tests to what unit tests structurally cannot cover.** Before adding or keeping an E2E test, check whether a Vitest component test already asserts the same claim with mocked Axios. If so, drop the E2E test — real browser + real server + real DB is expensive; don't pay for it twice. Keep E2E only for things a mocked unit test can never prove:
- Real auth/session behavior (login required, redirects, session-derived server state like `authorId`)
- Real persistence (a mutation survives a page reload — proves the DB round-trip, not just a mocked response)
- Real server-side query behavior (Prisma `orderBy`, filtering) that a unit test would otherwise fake by handing the component a pre-ordered array
- Divergence between the unit test's harness config and the real app's config (e.g. `client/src/test/render.tsx`'s `QueryClient` sets `retry: false`, so a real `retry`/backoff bug — like queries retrying on 404 — can *only* be caught by an E2E test; leave a comment on tests kept for this reason so they aren't mistaken for redundant later)

Pure client-side logic (Zod validation blocking a submit, a component rendering an empty-state string, a `Link` navigating) belongs in Vitest, not Playwright, even if no unit test happens to exist yet for it — write the unit test rather than reaching for E2E.

## Key Conventions

- Server entry: `server/src/index.ts` → imports `app.ts`, binds to `PORT`
- Client entry: `client/src/main.tsx` → wraps `<App>` in `<BrowserRouter>`
- Tailwind v4: no config file — import with `@import "tailwindcss"` in CSS; theme tokens in `client/src/index.css` via `@theme inline`
- Path alias: `@` maps to `client/src/` (configured in both `tsconfig.app.json` and `vite.config.ts`)
- shadcn/ui: `default` style, zinc-based palette, `cssVariables: true`; add components with `npx shadcn@latest add <component>` from `client/`
- **HTTP requests:** always use **Axios** (never `fetch`); import from `axios`
- **Server state:** always use **TanStack Query** (`useQuery`, `useMutation`) for data fetching — `QueryClientProvider` is already set up in `main.tsx`
- **Express 5 async error handling:** do NOT wrap route handlers in try/catch — Express 5 automatically forwards rejected promises to the error middleware. Only catch errors when you need to handle them locally (e.g. map to a specific response).
- **Validation:** use **Zod** on both client and server.
  - **Client forms:** always use React Hook Form + `zodResolver`. Define a `z.object` schema, infer `FormValues` from it, pass `resolver: zodResolver(schema)` to `useForm`, and render fields with shadcn `Form`/`FormField`/`FormMessage`. Surface server errors via `form.setError('root', ...)`. See `LoginPage.tsx` and `CreateUserDialog.tsx` for the canonical pattern.
  - **Server routes:** call `schema.safeParse(req.body)` at the top of the handler and return `400` with the first issue message on failure (see `controllers/users.ts`).
  - Zod is in root `package.json` so both workspaces can import it.
- **Prisma enums:** always import and use the generated enum (e.g. `import { Role } from '@prisma/client'`) — never hardcode the string value.
- Environment variables: copy `.env.example` → `.env` in project root
- **Workspace package resolution quirk:** server deps (`express`, `cors`, `better-auth`) are listed in root `package.json` (not just `server/package.json`) so Bun's resolver can find them from the root context
