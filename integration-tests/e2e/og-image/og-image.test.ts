import { expect, test } from '@playwright/test'

test.describe('og-image meta tags', () => {
  test('home page emits social image tags pointing to holocron.so', async ({ request }) => {
    const response = await request.get('/', {
      headers: { 'sec-fetch-dest': 'document' },
    })

    expect(response.status()).toBe(200)
    const html = await response.text()

    // OG images now point to the centralized holocron.so OG worker
    expect(html).toContain('property="og:image" content="https://holocron.so/api/og?')
    expect(html).toContain('name="twitter:card" content="summary_large_image"')

    // Should include title and siteName params
    expect(html).toMatch(/og:image.*title=/)
    expect(html).toMatch(/og:image.*siteName=/)
  })

  test('page emits page-specific social image tags', async ({ request }) => {
    const response = await request.get('/getting-started', {
      headers: { 'sec-fetch-dest': 'document' },
    })

    expect(response.status()).toBe(200)
    const html = await response.text()

    // Should contain OG image URL with page-specific title
    expect(html).toContain('property="og:image" content="https://holocron.so/api/og?')
    expect(html).toMatch(/og:image.*title=Getting/)
  })
})
