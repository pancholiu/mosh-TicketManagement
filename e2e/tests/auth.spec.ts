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

// ---------------------------------------------------------------------------
// Helper — performs a full UI login and persists the session to disk.
// Call this in a beforeAll hook; subsequent tests restore the state cheaply.
// ---------------------------------------------------------------------------
async function saveAdminStorageState(browser: Browser): Promise<void> {
  fs.mkdirSync(path.dirname(ADMIN_STORAGE_STATE), { recursive: true })
  // Playwright v1.52 applies test.use({ storageState }) to browser.newContext() in beforeAll.
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
// Group 1 — Login form: client-side (Zod) validation
//
// These tests submit the form without waiting for a network response.
// They verify that React Hook Form + Zod prevents the request and shows
// the correct inline error under each field.
// ===========================================================================
test.describe('Login form — client-side validation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
  })

  test('empty email field shows "Enter a valid email"', async ({ page }) => {
    // Submit with both fields blank; expect the email error to appear
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page.getByText('Enter a valid email')).toBeVisible()
  })

  test('malformed email (no @ sign) shows "Enter a valid email"', async ({ page }) => {
    await page.getByLabel('Email').fill('notanemail')
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page.getByText('Enter a valid email')).toBeVisible()
  })

  test('incomplete email (user@ only) shows "Enter a valid email"', async ({ page }) => {
    await page.getByLabel('Email').fill('user@')
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page.getByText('Enter a valid email')).toBeVisible()
  })

  test('empty password field shows "Password is required"', async ({ page }) => {
    // Fill a syntactically valid email so only the password validation fires
    await page.getByLabel('Email').fill('valid@example.com')
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page.getByText('Password is required')).toBeVisible()
  })

  test('page stays on /login after a validation failure', async ({ page }) => {
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page).toHaveURL('/login')
  })
})

// ===========================================================================
// Group 2 — Authentication flows: live server responses
//
// These tests complete the network round-trip and verify the outcomes that
// depend on what Better Auth returns (session creation or error payload).
// ===========================================================================
test.describe('Login flow — server responses', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
  })

  test('valid credentials redirect to / and show the user name in the nav', async ({ page }) => {
    await page.getByLabel('Email').fill(ADMIN_EMAIL)
    await page.getByLabel('Password').fill(ADMIN_PASSWORD)
    await page.getByRole('button', { name: 'Sign in' }).click()

    await page.waitForURL('/')
    await expect(page).toHaveURL('/')

    // The seeded admin account has name = "Admin"
    await expect(page.getByText('Admin')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible()
  })

  test('wrong password shows the server error message inline', async ({ page }) => {
    await page.getByLabel('Email').fill(ADMIN_EMAIL)
    await page.getByLabel('Password').fill('wrong-password-xyz')
    await page.getByRole('button', { name: 'Sign in' }).click()

    // Better Auth returns "Invalid email or password"; LoginPage renders it
    // as a <p> below the form fields via form.setError('root', { message })
    await expect(page.getByText('Invalid email or password')).toBeVisible()
    await expect(page).toHaveURL('/login')
  })

  test('non-existent email shows the server error message inline', async ({ page }) => {
    await page.getByLabel('Email').fill('nobody@test.example.com')
    await page.getByLabel('Password').fill('somepassword123')
    await page.getByRole('button', { name: 'Sign in' }).click()

    await expect(page.getByText('Invalid email or password')).toBeVisible()
    await expect(page).toHaveURL('/login')
  })

  test('submit button shows "Signing in…" and is disabled while the request is in flight', async ({ page }) => {
    // Delay the auth endpoint so there is a long enough window to assert the
    // loading state before the response arrives.
    await page.route('**/api/auth/sign-in/email', async (route) => {
      await new Promise<void>((resolve) => setTimeout(resolve, 600))
      await route.continue()
    })

    await page.getByLabel('Email').fill(ADMIN_EMAIL)
    await page.getByLabel('Password').fill(ADMIN_PASSWORD)

    // Fire the click without awaiting so control returns before the response
    void page.getByRole('button', { name: 'Sign in' }).click()

    const loadingButton = page.getByRole('button', { name: 'Signing in…' })
    await expect(loadingButton).toBeVisible()
    await expect(loadingButton).toBeDisabled()
  })
})

// ===========================================================================
// Group 3 — Protected routes: unauthenticated access
//
// Each test uses a fresh browser context (no storageState), which means no
// session cookie. ProtectedRoute and AdminRoute must redirect to /login.
// ===========================================================================
test.describe('Protected routes — unauthenticated access', () => {
  test('visiting / redirects to /login', async ({ page }) => {
    await page.goto('/')
    await page.waitForURL('/login')
    await expect(page).toHaveURL('/login')
  })

  test('visiting /users redirects to /login', async ({ page }) => {
    await page.goto('/users')
    await page.waitForURL('/login')
    await expect(page).toHaveURL('/login')
  })
})

// ===========================================================================
// Group 4 — Admin authenticated: nav visibility and access control
//
// storageState is pre-built by the beforeAll hook, then loaded into each
// test's browser context so every test starts already logged in.
// ===========================================================================
test.describe('Admin authenticated', () => {
  test.use({ storageState: ADMIN_STORAGE_STATE })

  test.beforeAll(async ({ browser }) => {
    await saveAdminStorageState(browser)
  })

  test('visiting /login while authenticated redirects to /', async ({ page }) => {
    await page.goto('/login')
    await page.waitForURL('/')
    await expect(page).toHaveURL('/')
  })

  test('nav shows the authenticated user name', async ({ page }) => {
    await page.goto('/')
    // The seeded admin's name is "Admin" (set in prisma/seed.ts)
    await expect(page.getByText('Admin')).toBeVisible()
  })

  test('admin sees the Users link in the nav', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('link', { name: 'Users' })).toBeVisible()
  })

  test('admin can navigate to /users via the nav link', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('link', { name: 'Users' }).click()
    await page.waitForURL('/users')
    await expect(page.getByRole('heading', { name: 'Users' })).toBeVisible()
  })

  test('admin can access /users directly by URL', async ({ page }) => {
    await page.goto('/users')
    await page.waitForURL('/users')
    await expect(page.getByRole('heading', { name: 'Users' })).toBeVisible()
  })
})

// ===========================================================================
// Group 5 — Sign out
//
// Uses the same storageState strategy as Group 4. Each test starts
// authenticated; the sign-out flow is exercised within the test body.
// Because each test gets a fresh context, sign-out in one test does not
// affect the starting state of the next.
// ===========================================================================
test.describe('Sign out', () => {
  test.use({ storageState: ADMIN_STORAGE_STATE })

  test.beforeEach(async ({ browser }) => {
    // Each sign-out test signs out, invalidating the server-side session. Use
    // beforeEach (not beforeAll) so every test starts with a fresh valid session.
    await saveAdminStorageState(browser)
  })

  test('clicking "Sign out" redirects to /login', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Sign out' }).click()
    await page.waitForURL('/login')
    await expect(page).toHaveURL('/login')
  })

  test('the login form is visible after sign out (no immediate redirect away)', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Sign out' }).click()
    await page.waitForURL('/login')

    // Confirm the login page is rendered, not just a transient redirect flash
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible()
  })

  test('after sign out, visiting / redirects back to /login', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Sign out' }).click()
    await page.waitForURL('/login')

    // The session cookie has been cleared by authClient.signOut(); the
    // ProtectedRoute should now treat this context as unauthenticated.
    await page.goto('/')
    await page.waitForURL('/login')
    await expect(page).toHaveURL('/login')
  })
})
