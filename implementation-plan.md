# Implementation Plan — AI-Powered Ticket Management System

---

## Phase 1 — Project Scaffolding & Infrastructure

**Goal:** Get a working full-stack skeleton running locally with Docker.

1. Initialize monorepo structure (`/client`, `/server`, `/prisma`)
2. Set up Node.js + Express backend with TypeScript
3. Set up React + TypeScript frontend with Vite
4. Set up PostgreSQL database
5. Seed the dtabase with an admin user
---

## Phase 2 — Database Schema & Auth

**Goal:** Model all entities and implement login/session system.

9. Design and write Prisma schema (`User`, `Ticket`, `Session`, `KnowledgeBase`)
10. Run initial migration
11. Seed database with admin user and sample data
12. Install and configure `express-session` with PostgreSQL session store
13. Build `POST /auth/login` endpoint
14. Build `POST /auth/logout` endpoint
15. Build `GET /auth/me` endpoint (current session user)
16. Protect routes with auth middleware (role-aware: admin vs agent)
17. Build login page (React) with form and error handling
18. Wire frontend auth state (store user in context, persist across refresh)

---

## Phase 3 — Ticket Core (CRUD & List)

**Goal:** Agents can view and manage tickets through the UI.

19. Build `GET /tickets` endpoint (list, with filters: status, category, search)
20. Build `GET /tickets/:id` endpoint (single ticket detail)
21. Build `PATCH /tickets/:id` endpoint (update status)
22. Build ticket list page with table, filter bar, and sort controls
23. Build ticket detail page (read-only first, shows full email content)
24. Add status badge component (Open / Resolved / Closed)
25. Add category badge component (General / Technical / Refund)
26. Add navigation layout (sidebar/header with role-aware links)

---

## Phase 4 — Email Ingestion

**Goal:** Incoming support emails automatically create tickets.

27. Choose and configure email provider (SendGrid Inbound Parse or Mailgun Routes)
28. Build `POST /webhooks/email` endpoint to receive parsed email payloads
29. Parse webhook payload → create `Ticket` record in database
30. Validate webhook authenticity (signature verification)
31. Write a test script to simulate inbound email webhooks locally
32. Handle edge cases: duplicate emails, missing fields, large payloads

---

## Phase 5 — AI Features

**Goal:** Automatic classification, smart replies, and summaries powered by Claude.

33. Set up Anthropic SDK and Claude API client
34. Load knowledge base content (static file or DB table)
35. Build classification service: send ticket body → Claude → return category
36. Auto-classify ticket on creation (call service from webhook handler)
37. Build summarization service: ticket thread → short summary
38. Build suggested reply service: ticket + knowledge base → draft reply
39. Expose `GET /tickets/:id/summary` endpoint
40. Expose `POST /tickets/:id/suggest-reply` endpoint
41. Display AI summary on ticket detail page
42. Display suggested reply with "Use this reply" button on ticket detail page
43. Allow agent to edit suggested reply before sending

---

## Phase 6 — Reply & Email Sending

**Goal:** Agents can send replies that go back to the customer via email.

44. Build `POST /tickets/:id/reply` endpoint (saves reply, updates status)
45. Integrate email provider SDK to send outbound emails
46. Trigger email send when a reply is submitted
47. Display reply history/thread on ticket detail page

---

## Phase 7 — User Management (Admin)

**Goal:** Admin can create and manage agents.

48. Build `GET /users` endpoint (admin only)
49. Build `POST /users` endpoint — create agent (admin only)
50. Build `DELETE /users/:id` endpoint (admin only)
51. Build User Management page (agent list + create form)
52. Guard all admin routes with role middleware on both backend and frontend

---

## Phase 8 — Dashboard & Polish

**Goal:** High-level overview and production-ready UI.

53. Build `GET /stats` endpoint (counts by status and category)
54. Build dashboard page with summary cards (open tickets, resolved today, etc.)
55. Add pagination to ticket list
56. Add loading states and error boundaries throughout the UI
57. Validate all forms (login, create user, reply)
58. Make UI responsive for common screen sizes

---

## Phase 9 — Deployment

**Goal:** Running in production.

59. Write production `Dockerfile` for backend and frontend
60. Configure `docker-compose.prod.yml`
61. Set up CI pipeline (build + lint on push)
62. Choose cloud provider and deploy (Railway / Fly.io recommended for simplicity)
63. Configure production environment variables and secrets
64. Run database migrations on deploy
65. Verify production email webhook end-to-end

---

## Summary

| Phase | Focus | Tasks |
|---|---|---|
| 1 | Scaffolding & Docker | 1–8 |
| 2 | Auth & DB Schema | 9–18 |
| 3 | Ticket CRUD & UI | 19–26 |
| 4 | Email Ingestion | 27–32 |
| 5 | AI Features | 33–43 |
| 6 | Reply & Sending | 44–47 |
| 7 | User Management | 48–52 |
| 8 | Dashboard & Polish | 53–58 |
| 9 | Deployment | 59–65 |

Phases 1–3 can be built and tested without any external APIs. Phase 4 unlocks email ingestion, Phase 5 unlocks AI — both can be mocked during earlier phases if needed.
