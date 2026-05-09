import { expect, test } from '@playwright/test'

test.describe('generated logo fallback', () => {
  test('home page html uses AI generated logo image from holocron.so', async ({ request }) => {
    const response = await request.get('/', {
      headers: { 'sec-fetch-dest': 'document' },
    })

    expect(response.status()).toBe(200)
    const html = await response.text()

    expect(html).toContain('https://holocron.so/api/ai-logo/test%20docs.jpeg')
    expect(html).not.toContain('/api/og/logo/')
  })
})
