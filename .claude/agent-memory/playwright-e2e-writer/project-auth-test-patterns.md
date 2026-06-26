---
name: project-auth-test-patterns
description: Patterns established in auth.spec.ts — storageState setup, seeded user facts, Better Auth error message text
metadata:
  type: project
---

## Authenticated session setup

Saved session path: `e2e/.auth/admin.json` (gitignored).

The helper `saveAdminStorageState(browser: Browser)` performs a full UI login,
saves cookies via `context.storageState({ path })`, then closes the context.
Call it in `test.beforeAll` inside each describe group that needs auth, then
apply `test.use({ storageState: ADMIN_STORAGE_STATE })` in the same group.

Each test then starts with the admin session pre-loaded — no UI login per test.

**Why:** workers=1 so describe blocks run serially; calling the helper once per
group keeps groups independent while avoiding repeated full-page logins in each test.

**How to apply:** Every new describe group that needs authentication should have
its own `beforeAll` + `test.use({ storageState })` pair. Do not share one
storageState call across multiple describe groups at the file's top level —
keeps isolation clean.

## Seeded admin user facts

- Email: `admin@test.example.com`
- Password: `test_admin_password_123`
- `user.name` field (shown in the nav): `"Admin"` (set in `prisma/seed.ts`)
- Role: `ADMIN`

## Better Auth error message for invalid credentials

Both wrong-password and non-existent-email cases return
`"Invalid email or password"` from the Better Auth `emailAndPassword` plugin.
`LoginPage.tsx` renders it via `form.setError('root', { message: error.message ?? 'Invalid email or password' })`.

Assert with: `await expect(page.getByText('Invalid email or password')).toBeVisible()`

## Route intercept pattern for loading-state tests

To observe the "Signing in…" button state (which disappears once the request
completes), intercept the endpoint and add a 600 ms delay:

```typescript
await page.route('**/api/auth/sign-in/email', async (route) => {
  await new Promise<void>((resolve) => setTimeout(resolve, 600))
  await route.continue()
})
void page.getByRole('button', { name: 'Sign in' }).click()
await expect(page.getByRole('button', { name: 'Signing in…' })).toBeVisible()
```

The `void` discards the click Promise intentionally so we can check state
before the response arrives.

## gitignore entry

`e2e/.auth/` must be in `.gitignore` — session files contain auth cookies.
Already added.
