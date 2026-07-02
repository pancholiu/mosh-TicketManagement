import { test, expect, type Browser } from '@playwright/test'
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

// Tickets are created via the inbound email webhook — no UI form exists yet.
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

// ===========================================================================
// Group 1 — Unauthenticated access
//
// Uses a fresh context with no storageState. ProtectedRoute must redirect
// unauthenticated visitors away from /tickets to /login.
// ===========================================================================
test.describe('Tickets — unauthenticated access', () => {
  test('visiting /tickets redirects to /login', async ({ page }) => {
    await page.goto('/tickets')
    await page.waitForURL('/login')
    await expect(page).toHaveURL('/login')
  })
})

// ===========================================================================
// Group 2 — Authenticated: page structure, navigation, and ticket list
//
// storageState is pre-built by beforeAll, then loaded into each test context.
// Tickets are created via the webhook request fixture — not the UI — because
// no ticket creation UI exists at this point. Tests do NOT clean up tickets
// between runs; each test uses a distinguishable subject to identify its rows.
// ===========================================================================
test.describe('Tickets — authenticated', () => {
  test.use({ storageState: ADMIN_STORAGE_STATE })

  test.beforeAll(async ({ browser }) => {
    await saveAdminStorageState(browser)
  })

  // -------------------------------------------------------------------------
  // Page structure
  // -------------------------------------------------------------------------

  test('page heading "Tickets" is visible at /tickets', async ({ page }) => {
    await page.goto('/tickets')
    await page.waitForURL('/tickets')
    await expect(page.getByRole('heading', { name: 'Tickets' })).toBeVisible()
  })

  // -------------------------------------------------------------------------
  // Navigation
  // -------------------------------------------------------------------------

  test('"Tickets" nav link is visible when authenticated', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('link', { name: 'Tickets' })).toBeVisible()
  })

  test('clicking "Tickets" nav link navigates to /tickets', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('link', { name: 'Tickets' }).click()
    await page.waitForURL('/tickets')
    await expect(page).toHaveURL('/tickets')
    await expect(page.getByRole('heading', { name: 'Tickets' })).toBeVisible()
  })

  // -------------------------------------------------------------------------
  // Ticket list content
  // -------------------------------------------------------------------------

  test('a ticket created via webhook appears in the table', async ({ page, request }) => {
    await request.post(WEBHOOK_URL, {
      headers: { Authorization: `Bearer ${WEBHOOK_SECRET}` },
      data: {
        from: 'list-test@example.com',
        subject: 'E2E List Visibility Test',
        body: 'Please help me with my account.',
      },
    })

    await page.goto('/tickets')
    await page.waitForURL('/tickets')

    const table = page.getByRole('table')
    await expect(table.getByText('E2E List Visibility Test').first()).toBeVisible()
    await expect(table.getByText('list-test@example.com').first()).toBeVisible()
  })

  test('tickets are displayed newest first', async ({ page, request }) => {
    await request.post(WEBHOOK_URL, {
      headers: { Authorization: `Bearer ${WEBHOOK_SECRET}` },
      data: {
        from: 'sort-test@example.com',
        subject: 'E2E Sort Test - First Created',
        body: 'This is the first ticket in the sort test.',
      },
    })

    await request.post(WEBHOOK_URL, {
      headers: { Authorization: `Bearer ${WEBHOOK_SECRET}` },
      data: {
        from: 'sort-test@example.com',
        subject: 'E2E Sort Test - Second Created',
        body: 'This is the second ticket in the sort test.',
      },
    })

    await page.goto('/tickets')
    await page.waitForURL('/tickets')

    const table = page.getByRole('table')
    // Wait for the data to finish loading before scanning rows
    await expect(table.getByText('E2E Sort Test - Second Created').first()).toBeVisible()

    // Scan all table rows top-to-bottom (newest first) and record the first
    // occurrence of each subject. The second-created ticket must appear at a
    // lower row index than the first-created one.
    const rows = page.getByRole('table').getByRole('row')
    const rowCount = await rows.count()

    let firstCreatedRowIndex = -1
    let secondCreatedRowIndex = -1

    for (let i = 0; i < rowCount; i++) {
      const text = await rows.nth(i).textContent()
      if (text?.includes('E2E Sort Test - First Created') && firstCreatedRowIndex === -1) {
        firstCreatedRowIndex = i
      }
      if (text?.includes('E2E Sort Test - Second Created') && secondCreatedRowIndex === -1) {
        secondCreatedRowIndex = i
      }
    }

    expect(secondCreatedRowIndex).toBeGreaterThan(-1)
    expect(firstCreatedRowIndex).toBeGreaterThan(-1)
    // "Second Created" was inserted after "First Created", so it is the newer
    // record and must appear higher in the table (lower row index).
    expect(secondCreatedRowIndex).toBeLessThan(firstCreatedRowIndex)
  })

  test('a new ticket displays an "OPEN" status badge', async ({ page, request }) => {
    await request.post(WEBHOOK_URL, {
      headers: { Authorization: `Bearer ${WEBHOOK_SECRET}` },
      data: {
        from: 'badge-test@example.com',
        subject: 'E2E Status Badge Test',
        body: 'Testing the open status badge display.',
      },
    })

    await page.goto('/tickets')
    await page.waitForURL('/tickets')

    const table = page.getByRole('table')
    // Confirm the ticket row is rendered before asserting the badge
    await expect(table.getByText('E2E Status Badge Test').first()).toBeVisible()
    // All webhook-created tickets start as OPEN; at least one OPEN badge must
    // be visible. Use exact match to avoid hitting "REOPEN" or similar text.
    await expect(table.getByText('OPEN', { exact: true }).first()).toBeVisible()
  })
})
