import { test, expect, type Browser, type APIRequestContext } from '@playwright/test'
import path from 'path'
import fs from 'fs'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const ADMIN_EMAIL = 'admin@test.example.com'
const ADMIN_PASSWORD = 'test_admin_password_123'

// Session cookies for the admin are written here once per describe group and
// loaded into each test context via test.use({ storageState }).
const ADMIN_STORAGE_STATE = path.join(process.cwd(), 'e2e', '.auth', 'admin.json')

// Tickets are created via the inbound email webhook — no UI form exists for that.
const WEBHOOK_URL = 'http://localhost:3001/webhooks/email'
const WEBHOOK_SECRET = 'webhook-secret-123'

// ---------------------------------------------------------------------------
// Helper — performs a full UI login and persists the session to disk.
// Call this in a beforeAll hook; subsequent tests restore the state cheaply.
// ---------------------------------------------------------------------------
async function saveAdminStorageState(browser: Browser): Promise<void> {
  fs.mkdirSync(path.dirname(ADMIN_STORAGE_STATE), { recursive: true })
  // Always write an empty state first so: (a) the file exists for the read, and
  // (b) the context starts unauthenticated so the login below creates a fresh session.
  fs.writeFileSync(ADMIN_STORAGE_STATE, JSON.stringify({ cookies: [], origins: [] }))

  const context = await browser.newContext()
  const page = await context.newPage()

  await page.goto('/login')
  await page.getByLabel('Email').fill(ADMIN_EMAIL)
  await page.getByLabel('Password').fill(ADMIN_PASSWORD)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL('/')

  await context.storageState({ path: ADMIN_STORAGE_STATE })
  await context.close()
}

// ---------------------------------------------------------------------------
// Helper — creates a fresh ticket via the webhook and returns its id, so each
// test can navigate straight to /tickets/:id without depending on list-page
// row order or accumulated data from prior runs. Every ticket starts with
// zero replies, which also gives the empty-state test a clean fixture.
// ---------------------------------------------------------------------------
async function createTicket(request: APIRequestContext, subject: string): Promise<string> {
  const response = await request.post(WEBHOOK_URL, {
    headers: { Authorization: `Bearer ${WEBHOOK_SECRET}` },
    data: {
      from: 'reply-test@example.com',
      subject,
      body: 'Ticket body used as fixture data for reply E2E tests.',
    },
  })
  const ticket = await response.json()
  return ticket.id as string
}

// ===========================================================================
// Ticket replies — authenticated
//
// storageState is pre-built by beforeAll, then loaded into each test context.
// Every test creates its own ticket via the webhook fixture (see createTicket
// above) so tests remain independent even though the DB is shared and
// accumulates data across runs.
// ===========================================================================
test.describe('Ticket replies — authenticated', () => {
  test.use({ storageState: ADMIN_STORAGE_STATE })

  test.beforeAll(async ({ browser }) => {
    await saveAdminStorageState(browser)
  })

  // -------------------------------------------------------------------------
  // Empty state
  // -------------------------------------------------------------------------

  test('a ticket with no replies shows "No replies yet."', async ({ page, request }) => {
    const ticketId = await createTicket(request, 'E2E Reply Test - Empty State')
    await page.goto(`/tickets/${ticketId}`)

    await expect(page.getByRole('heading', { name: 'E2E Reply Test - Empty State' })).toBeVisible()
    await expect(page.getByText('No replies yet.')).toBeVisible()
  })

  // -------------------------------------------------------------------------
  // Submitting a reply
  // -------------------------------------------------------------------------

  test('submitting a reply shows it immediately with author name and "Agent" badge, and clears the textarea', async ({
    page,
    request,
  }) => {
    const ticketId = await createTicket(request, 'E2E Reply Test - Submit')
    await page.goto(`/tickets/${ticketId}`)
    await expect(page.getByRole('heading', { name: 'E2E Reply Test - Submit' })).toBeVisible()

    const replyBody = 'Thanks for reaching out — we are looking into this for you.'
    const textarea = page.getByLabel('Reply')
    await textarea.fill(replyBody)

    const responsePromise = page.waitForResponse(
      (res) => res.url().includes(`/tickets/${ticketId}/replies`) && res.request().method() === 'POST'
    )
    await page.getByRole('button', { name: 'Send reply' }).click()
    await responsePromise

    // Scope the author/badge assertions to the specific reply container
    // (the body <p>'s parent div) to avoid matching the "Admin" nav label.
    const replyContainer = page.getByText(replyBody, { exact: true }).locator('..')
    await expect(replyContainer.getByText('Admin', { exact: true })).toBeVisible()
    await expect(replyContainer.getByText('Agent', { exact: true })).toBeVisible()

    await expect(textarea).toHaveValue('')
  })

  // -------------------------------------------------------------------------
  // Persistence across reload
  // -------------------------------------------------------------------------

  test('a reply persists after reloading the page', async ({ page, request }) => {
    const ticketId = await createTicket(request, 'E2E Reply Test - Persistence')
    await page.goto(`/tickets/${ticketId}`)
    await expect(page.getByRole('heading', { name: 'E2E Reply Test - Persistence' })).toBeVisible()

    const replyBody = 'This reply must still be here after a reload.'
    await page.getByLabel('Reply').fill(replyBody)

    const responsePromise = page.waitForResponse(
      (res) => res.url().includes(`/tickets/${ticketId}/replies`) && res.request().method() === 'POST'
    )
    await page.getByRole('button', { name: 'Send reply' }).click()
    await responsePromise

    await expect(page.getByText(replyBody, { exact: true })).toBeVisible()

    // Reload forces a real GET /tickets/:id round-trip — the reply must come
    // back from the database, not just the optimistic query cache update.
    await page.reload()

    await expect(page.getByRole('heading', { name: 'E2E Reply Test - Persistence' })).toBeVisible()
    await expect(page.getByText(replyBody, { exact: true })).toBeVisible()
  })

  // -------------------------------------------------------------------------
  // Client-side validation
  // -------------------------------------------------------------------------

  test('submitting an empty reply shows "Reply cannot be empty" and sends no request', async ({
    page,
    request,
  }) => {
    const ticketId = await createTicket(request, 'E2E Reply Test - Empty Validation')
    await page.goto(`/tickets/${ticketId}`)
    await expect(page.getByRole('heading', { name: 'E2E Reply Test - Empty Validation' })).toBeVisible()

    let replyRequestFired = false
    page.on('request', (req) => {
      if (req.method() === 'POST' && req.url().includes(`/tickets/${ticketId}/replies`)) {
        replyRequestFired = true
      }
    })

    await page.getByRole('button', { name: 'Send reply' }).click()

    await expect(page.getByText('Reply cannot be empty')).toBeVisible()
    expect(replyRequestFired).toBe(false)
  })

  test('submitting a whitespace-only reply shows "Reply cannot be empty" and sends no request', async ({
    page,
    request,
  }) => {
    const ticketId = await createTicket(request, 'E2E Reply Test - Whitespace Validation')
    await page.goto(`/tickets/${ticketId}`)
    await expect(page.getByRole('heading', { name: 'E2E Reply Test - Whitespace Validation' })).toBeVisible()

    let replyRequestFired = false
    page.on('request', (req) => {
      if (req.method() === 'POST' && req.url().includes(`/tickets/${ticketId}/replies`)) {
        replyRequestFired = true
      }
    })

    await page.getByLabel('Reply').fill('   ')
    await page.getByRole('button', { name: 'Send reply' }).click()

    await expect(page.getByText('Reply cannot be empty')).toBeVisible()
    expect(replyRequestFired).toBe(false)
  })

  // -------------------------------------------------------------------------
  // Chronological ordering
  // -------------------------------------------------------------------------

  test('multiple replies render in chronological (oldest-first) order', async ({ page, request }) => {
    const ticketId = await createTicket(request, 'E2E Reply Test - Order')
    await page.goto(`/tickets/${ticketId}`)
    await expect(page.getByRole('heading', { name: 'E2E Reply Test - Order' })).toBeVisible()

    const firstReply = 'E2E Reply Order - first reply sent'
    const secondReply = 'E2E Reply Order - second reply sent'

    await page.getByLabel('Reply').fill(firstReply)
    const firstResponsePromise = page.waitForResponse(
      (res) => res.url().includes(`/tickets/${ticketId}/replies`) && res.request().method() === 'POST'
    )
    await page.getByRole('button', { name: 'Send reply' }).click()
    await firstResponsePromise
    await expect(page.getByText(firstReply, { exact: true })).toBeVisible()

    await page.getByLabel('Reply').fill(secondReply)
    const secondResponsePromise = page.waitForResponse(
      (res) => res.url().includes(`/tickets/${ticketId}/replies`) && res.request().method() === 'POST'
    )
    await page.getByRole('button', { name: 'Send reply' }).click()
    await secondResponsePromise
    await expect(page.getByText(secondReply, { exact: true })).toBeVisible()

    // Replies stack top-to-bottom in DOM/visual order; the reply list is
    // rendered oldest-first, so the first-sent reply must sit above the
    // second-sent one. Compare vertical position instead of a CSS-class
    // selector to avoid depending on styling internals.
    const firstBox = await page.getByText(firstReply, { exact: true }).boundingBox()
    const secondBox = await page.getByText(secondReply, { exact: true }).boundingBox()

    expect(firstBox).not.toBeNull()
    expect(secondBox).not.toBeNull()
    expect(firstBox!.y).toBeLessThan(secondBox!.y)
  })
})

// ===========================================================================
// Ticket replies — unauthenticated access
//
// The replies endpoint is mounted under the existing /tickets router, which
// already requires requireAuth. A fresh context with no storageState should
// never reach the ticket detail page at all — ProtectedRoute redirects to
// /login before any reply UI can render.
// ===========================================================================
test.describe('Ticket replies — unauthenticated access', () => {
  test('visiting a ticket detail page while unauthenticated redirects to /login', async ({ page, request }) => {
    const ticketId = await createTicket(request, 'E2E Reply Test - Unauthenticated Access')
    await page.goto(`/tickets/${ticketId}`)
    await page.waitForURL('/login')
    await expect(page).toHaveURL('/login')
  })
})
