---
name: project-ticket-detail-test-patterns
description: Patterns established in ticket-replies.spec.ts — navigating via webhook-returned id, scoping assertions to avoid nav-name collisions, order-by-position, no-request-fired validation checks
metadata:
  type: project
---

## Capture the id from the webhook response to navigate directly

`request.post(WEBHOOK_URL, ...)` returns the created ticket as JSON (the
controller does `res.status(201).json(ticket)`). Read `ticket.id` and
`page.goto(`/tickets/${ticketId}`)` directly instead of going through the
list page and clicking a row. This sidesteps ambiguity from accumulated rows
with similar subjects across test runs, and is faster:

```ts
async function createTicket(request: APIRequestContext, subject: string): Promise<string> {
  const response = await request.post(WEBHOOK_URL, {
    headers: { Authorization: `Bearer ${WEBHOOK_SECRET}` },
    data: { from: 'reply-test@example.com', subject, body: '...' },
  })
  const ticket = await response.json()
  return ticket.id as string
}
```

Every fresh ticket also starts with zero replies, which is a convenient
built-in fixture for empty-state tests — no separate cleanup needed.

## Scope assertions to avoid the nav "Admin" text collision

The signed-in admin's name ("Admin") appears in the nav bar on every page.
When a reply's author name is also "Admin" (same seeded user), a bare
`page.getByText('Admin')` is a strict-mode violation (multiple matches).
Scope to the specific reply's container by walking up from its unique body
text instead:

```ts
const replyContainer = page.getByText(replyBody, { exact: true }).locator('..')
await expect(replyContainer.getByText('Admin', { exact: true })).toBeVisible()
await expect(replyContainer.getByText('Agent', { exact: true })).toBeVisible()
```

This relies on `TicketDetailPage.tsx`'s `ReplyList` DOM shape: the author
name span, sender-type Badge, and timestamp are siblings inside one wrapper
div, and the body `<p>` is the next sibling under the *same* parent — so
`.locator('..')` from the body paragraph reaches the reply's own container in
one hop. Anchor on the reply body text (unique per test), not the author name.

## Asserting DOM/visual order without a CSS selector

To confirm replies render oldest-first, avoid selecting by class name (the
list-item and the ticket's own "Message" body share the same paragraph
classes). Instead compare bounding-box Y position of two known reply texts:

```ts
const firstBox = await page.getByText(firstReply, { exact: true }).boundingBox()
const secondBox = await page.getByText(secondReply, { exact: true }).boundingBox()
expect(firstBox!.y).toBeLessThan(secondBox!.y)
```

## Asserting "no network request fired" for client-side validation

Client-side Zod validation (via `zodResolver`) runs synchronously inside
`react-hook-form`'s `handleSubmit` before the mutation's `mutate()` is ever
called, so there's no race to worry about — register a `page.on('request', ...)`
listener before clicking, then assert the flag after the validation message
appears:

```ts
let replyRequestFired = false
page.on('request', (req) => {
  if (req.method() === 'POST' && req.url().includes(`/tickets/${ticketId}/replies`)) {
    replyRequestFired = true
  }
})
await page.getByRole('button', { name: 'Send reply' }).click()
await expect(page.getByText('Reply cannot be empty')).toBeVisible()
expect(replyRequestFired).toBe(false)
```

## Waiting for a POST to a dynamic (per-test) URL

Use a predicate function instead of a glob string when the URL contains a
per-test id (e.g. ticket id from `createTicket`):

```ts
const responsePromise = page.waitForResponse(
  (res) => res.url().includes(`/tickets/${ticketId}/replies`) && res.request().method() === 'POST'
)
await page.getByRole('button', { name: 'Send reply' }).click()
await responsePromise
```

## Test data subjects used (do not reuse — pick new distinguishable prefixes)

- `'E2E Reply Test - Empty State'`
- `'E2E Reply Test - Submit'`
- `'E2E Reply Test - Persistence'`
- `'E2E Reply Test - Empty Validation'` / `'E2E Reply Test - Whitespace Validation'`
- `'E2E Reply Test - Order'` (reply bodies: `'E2E Reply Order - first/second reply sent'`)
- `'E2E Reply Test - Unauthenticated Access'`

See [[project-auth-test-patterns]] for `saveAdminStorageState`, and
[[project-ticket-test-patterns]] for the webhook-fixture and badge
exact-match conventions this file builds on.
