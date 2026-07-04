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
// row order or accumulated data from prior runs. Every fresh ticket starts as
// OPEN, uncategorized, and unassigned — a convenient built-in fixture for the
// "initial state" assertions below.
// ---------------------------------------------------------------------------
async function createTicket(request: APIRequestContext, subject: string): Promise<string> {
  const response = await request.post(WEBHOOK_URL, {
    headers: { Authorization: `Bearer ${WEBHOOK_SECRET}` },
    data: {
      from: 'detail-test@example.com',
      subject,
      body: 'Ticket body used as fixture data for ticket detail E2E tests.',
    },
  })
  const ticket = await response.json()
  return ticket.id as string
}

// ---------------------------------------------------------------------------
// Helper — scopes to the field's own container by walking up from the field
// label's exact text, then returns the Select trigger within it. This avoids
// ambiguity between the three Select triggers on the page (Status, Category,
// Assigned to), which share no distinguishing role/name once a value other
// than the default is selected.
// ---------------------------------------------------------------------------
function fieldTrigger(page: import('@playwright/test').Page, labelText: string) {
  return page.getByText(labelText, { exact: true }).locator('..').getByRole('combobox')
}

// ===========================================================================
// Ticket detail page — authenticated
//
// storageState is pre-built by beforeAll, then loaded into each test context.
// Every test creates its own ticket via the webhook fixture so tests remain
// independent even though the DB is shared and accumulates data across runs.
// ===========================================================================
test.describe('Ticket detail page — authenticated', () => {
  test.use({ storageState: ADMIN_STORAGE_STATE })

  test.beforeAll(async ({ browser }) => {
    await saveAdminStorageState(browser)
  })

  // -------------------------------------------------------------------------
  // Initial page content for a freshly created ticket
  // -------------------------------------------------------------------------

  test('displays subject, from, message body, and default OPEN/Uncategorized/Unassigned state', async ({
    page,
    request,
  }) => {
    const ticketId = await createTicket(request, 'E2E Detail Test - Initial State')
    await page.goto(`/tickets/${ticketId}`)

    await expect(page.getByRole('heading', { name: 'E2E Detail Test - Initial State' })).toBeVisible()
    await expect(page.getByText('detail-test@example.com')).toBeVisible()
    await expect(
      page.getByText('Ticket body used as fixture data for ticket detail E2E tests.')
    ).toBeVisible()

    await expect(fieldTrigger(page, 'Status')).toHaveText('Open')
    await expect(fieldTrigger(page, 'Category')).toHaveText('Uncategorized')
    await expect(fieldTrigger(page, 'Assigned to')).toHaveText('Unassigned')
  })

  // -------------------------------------------------------------------------
  // Back navigation
  // -------------------------------------------------------------------------

  test('"Back to tickets" link navigates to /tickets', async ({ page, request }) => {
    const ticketId = await createTicket(request, 'E2E Detail Test - Back Navigation')
    await page.goto(`/tickets/${ticketId}`)
    await expect(page.getByRole('heading', { name: 'E2E Detail Test - Back Navigation' })).toBeVisible()

    await page.getByRole('link', { name: 'Back to tickets' }).click()
    await page.waitForURL('/tickets')
    await expect(page).toHaveURL('/tickets')
  })

  // -------------------------------------------------------------------------
  // Status select — persistence
  // -------------------------------------------------------------------------

  test('changing Status to Resolved persists after reload', async ({ page, request }) => {
    const ticketId = await createTicket(request, 'E2E Detail Test - Status Persistence')
    await page.goto(`/tickets/${ticketId}`)
    await expect(page.getByRole('heading', { name: 'E2E Detail Test - Status Persistence' })).toBeVisible()

    const statusTrigger = fieldTrigger(page, 'Status')
    await expect(statusTrigger).toHaveText('Open')

    const responsePromise = page.waitForResponse(
      (res) => res.url().includes(`/tickets/${ticketId}`) && res.request().method() === 'PATCH'
    )
    await statusTrigger.click()
    await page.getByRole('option', { name: 'Resolved' }).click()
    await responsePromise

    await expect(statusTrigger).toHaveText('Resolved')

    await page.reload()
    await expect(page.getByRole('heading', { name: 'E2E Detail Test - Status Persistence' })).toBeVisible()
    await expect(fieldTrigger(page, 'Status')).toHaveText('Resolved')
  })

  // -------------------------------------------------------------------------
  // Category select — persistence
  // -------------------------------------------------------------------------

  test('changing Category to Technical persists after reload', async ({ page, request }) => {
    const ticketId = await createTicket(request, 'E2E Detail Test - Category Persistence')
    await page.goto(`/tickets/${ticketId}`)
    await expect(page.getByRole('heading', { name: 'E2E Detail Test - Category Persistence' })).toBeVisible()

    const categoryTrigger = fieldTrigger(page, 'Category')
    await expect(categoryTrigger).toHaveText('Uncategorized')

    const responsePromise = page.waitForResponse(
      (res) => res.url().includes(`/tickets/${ticketId}`) && res.request().method() === 'PATCH'
    )
    await categoryTrigger.click()
    await page.getByRole('option', { name: 'Technical' }).click()
    await responsePromise

    await expect(categoryTrigger).toHaveText('Technical')

    await page.reload()
    await expect(page.getByRole('heading', { name: 'E2E Detail Test - Category Persistence' })).toBeVisible()
    await expect(fieldTrigger(page, 'Category')).toHaveText('Technical')
  })

  // -------------------------------------------------------------------------
  // Assigned to select — persistence
  // -------------------------------------------------------------------------

  test('assigning the ticket to the admin user persists after reload', async ({ page, request }) => {
    const ticketId = await createTicket(request, 'E2E Detail Test - Assignee Persistence')
    await page.goto(`/tickets/${ticketId}`)
    await expect(page.getByRole('heading', { name: 'E2E Detail Test - Assignee Persistence' })).toBeVisible()

    const assigneeTrigger = fieldTrigger(page, 'Assigned to')
    await expect(assigneeTrigger).toHaveText('Unassigned')

    const responsePromise = page.waitForResponse(
      (res) => res.url().includes(`/tickets/${ticketId}/assign`) && res.request().method() === 'PATCH'
    )
    await assigneeTrigger.click()
    // The seeded admin test user ("Admin") is the only assignable user in the
    // test DB, and is populated from GET /tickets/assignees.
    await page.getByRole('option', { name: 'Admin' }).click()
    await responsePromise

    // Scope to the trigger to avoid the strict-mode collision with the nav
    // bar's "Admin" label (see project-ticket-detail-test-patterns memory).
    await expect(assigneeTrigger).toHaveText('Admin')

    await page.reload()
    await expect(page.getByRole('heading', { name: 'E2E Detail Test - Assignee Persistence' })).toBeVisible()
    await expect(fieldTrigger(page, 'Assigned to')).toHaveText('Admin')
  })

  // -------------------------------------------------------------------------
  // 404 state
  //
  // The "shows Ticket not found" render logic is also asserted in
  // TicketDetailPage.test.tsx, but that unit test's QueryClient is configured
  // with `retry: false` (see client/src/test/render.tsx) — it can never catch
  // a regression in the real app's retry behavior. The real QueryClient
  // (client/src/main.tsx) previously retried failed queries (including 404s)
  // up to 3 times with exponential backoff, which delayed this exact error
  // state by several seconds in production. Keep this test as the only thing
  // exercising the real retry config end-to-end.
  // -------------------------------------------------------------------------

  test('visiting a nonexistent ticket id shows "Ticket not found"', async ({ page }) => {
    await page.goto('/tickets/nonexistent-ticket-id')

    await expect(page.getByText('Ticket not found')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Back to tickets' })).toBeVisible()
  })
})

// ===========================================================================
// Ticket detail page — unauthenticated access
//
// The ticket detail route is mounted under the existing /tickets router,
// which already requires requireAuth. A fresh context with no storageState
// should never reach the ticket detail page at all — ProtectedRoute
// redirects to /login before any detail UI can render.
// ===========================================================================
test.describe('Ticket detail page — unauthenticated access', () => {
  test('visiting /tickets/:id while unauthenticated redirects to /login', async ({ page, request }) => {
    const ticketId = await createTicket(request, 'E2E Detail Test - Unauthenticated Access')
    await page.goto(`/tickets/${ticketId}`)
    await page.waitForURL('/login')
    await expect(page).toHaveURL('/login')
  })
})
