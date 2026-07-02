import { test, expect } from '@playwright/test'

const PORT = process.env.PORT ?? '3000'
const WEBHOOK_URL = `http://localhost:${PORT}/webhooks/email`
const SECRET = process.env.WEBHOOK_SECRET ?? 'webhook-secret-123'

const VALID_PAYLOAD = {
  from: 'customer@example.com',
  subject: 'I need help with my order',
  body: 'Hi, I placed an order last week and have not received a confirmation.',
}

// ===========================================================================
// Webhook — POST /webhooks/email
//
// These tests call the Express server directly (not through the Vite proxy)
// because Playwright's request fixture is transport-level and does not need
// a browser page. All tests use serial execution (workers: 1 in the config).
// ===========================================================================

test.describe('POST /webhooks/email — happy path', () => {
  test('valid payload and correct secret returns 201 with the created ticket', async ({ request }) => {
    const response = await request.post(WEBHOOK_URL, {
      headers: { Authorization: `Bearer ${SECRET}` },
      data: VALID_PAYLOAD,
    })

    expect(response.status()).toBe(201)

    const body = await response.json()
    expect(body.id).toBeTruthy()
    expect(body.from).toBe(VALID_PAYLOAD.from)
    expect(body.subject).toBe(VALID_PAYLOAD.subject)
    expect(body.body).toBe(VALID_PAYLOAD.body)
    expect(body.status).toBe('OPEN')
  })
})

test.describe('POST /webhooks/email — auth failures', () => {
  test('missing Authorization header returns 401', async ({ request }) => {
    const response = await request.post(WEBHOOK_URL, {
      data: VALID_PAYLOAD,
    })

    expect(response.status()).toBe(401)
    const body = await response.json()
    expect(body.error).toBe('Unauthorized')
  })

  test('wrong secret returns 401', async ({ request }) => {
    const response = await request.post(WEBHOOK_URL, {
      headers: { Authorization: 'Bearer wrong-secret' },
      data: VALID_PAYLOAD,
    })

    expect(response.status()).toBe(401)
    const body = await response.json()
    expect(body.error).toBe('Unauthorized')
  })
})

test.describe('POST /webhooks/email — validation failures', () => {
  test('invalid from address returns 400', async ({ request }) => {
    const response = await request.post(WEBHOOK_URL, {
      headers: { Authorization: `Bearer ${SECRET}` },
      data: { ...VALID_PAYLOAD, from: 'not-an-email' },
    })

    expect(response.status()).toBe(400)
    const body = await response.json()
    expect(body.error).toBe('Invalid sender email')
  })

  test('empty subject returns 400', async ({ request }) => {
    const response = await request.post(WEBHOOK_URL, {
      headers: { Authorization: `Bearer ${SECRET}` },
      data: { ...VALID_PAYLOAD, subject: '' },
    })

    expect(response.status()).toBe(400)
    const body = await response.json()
    expect(body.error).toBe('Subject is required')
  })

  test('empty body returns 400', async ({ request }) => {
    const response = await request.post(WEBHOOK_URL, {
      headers: { Authorization: `Bearer ${SECRET}` },
      data: { ...VALID_PAYLOAD, body: '' },
    })

    expect(response.status()).toBe(400)
    const body = await response.json()
    expect(body.error).toBe('Body is required')
  })
})
