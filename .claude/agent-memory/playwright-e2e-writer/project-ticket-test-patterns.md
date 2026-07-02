---
name: project-ticket-test-patterns
description: Patterns established in tickets.spec.ts — webhook fixture for creating tickets, sort-order assertion strategy, badge exact-match
metadata:
  type: project
---

## Creating tickets in tests

No UI exists for ticket creation. Use Playwright's `request` fixture to POST
to the webhook endpoint directly (separate API context — no browser session involved):

```ts
const WEBHOOK_URL = 'http://localhost:3001/webhooks/email'
const WEBHOOK_SECRET = 'webhook-secret-123'

await request.post(WEBHOOK_URL, {
  headers: { Authorization: `Bearer ${WEBHOOK_SECRET}` },
  data: { from: 'x@example.com', subject: 'My Subject', body: 'Body text.' },
})
```

The `request` fixture is available in any test alongside `page` — just add it
to the test's destructured argument.

## Sort-order assertion pattern

To assert newest-first ordering without cleaning up old rows (DB is shared and
tests accumulate tickets across runs):

1. Create ticket A then ticket B in the same test.
2. Navigate to the list page.
3. Scan all `getByRole('row')` top-to-bottom; record the **first** occurrence
   index of each subject (first occurrence = the newest instance when sorted
   newest-first).
4. Assert `secondCreatedIndex < firstCreatedIndex`.

Prior-run duplicates sit below both, so `findIndex`-style scanning is safe
even with accumulated rows.

## Badge text assertion

Status badges render as short text labels. Use `{ exact: true }` to avoid
matching substrings (e.g., `getByText('OPEN', { exact: true })`) and scope to
the table element (`page.getByRole('table')`). Use `.first()` when multiple
rows with OPEN badges may exist from prior test runs.

## Test data subjects

Conventions used in tickets.spec.ts (do not reuse in new tests — create new
distinguishable prefixes):

- `'E2E List Visibility Test'` — basic list-appearance test
- `'E2E Sort Test - First Created'` / `'E2E Sort Test - Second Created'` — sort order
- `'E2E Status Badge Test'` — OPEN badge visibility

See [[project-auth-test-patterns]] for the `saveAdminStorageState` helper used
in the `beforeAll` of each authenticated describe block.
