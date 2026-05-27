import { expect, test } from '../helpers/test.ts'

test.describe('generated logo fallback', () => {
  test('home page html uses local ai-logo proxy route', async ({ request }) => {
    const response = await request.get('/', {
      headers: { 'sec-fetch-dest': 'document' },
    })

    expect(response.status()).toBe(200)
    const html = await response.text()

    expect(html).toContain('/holocron-api/ai-logo/test%20docs.jpeg')
    expect(html).not.toContain('https://holocron.so/holocron-api/ai-logo/')
    expect(html).not.toContain('/holocron-api/og/logo/')
  })
})
