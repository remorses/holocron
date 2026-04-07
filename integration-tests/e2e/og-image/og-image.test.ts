import { expect, test } from '@playwright/test'

test.describe('og-image routes', () => {
  test('homepage og route returns a PNG', async ({ request }) => {
    const response = await request.get('/og')

    expect(response.status()).toBe(200)
    expect(response.headers()['content-type']).toContain('image/png')

    const png = await response.body()
    expect(Array.from(png.subarray(0, 4))).toEqual([137, 80, 78, 71])
  })

  test('page og route returns a PNG', async ({ request }) => {
    const response = await request.get('/og/getting-started')

    expect(response.status()).toBe(200)
    expect(response.headers()['content-type']).toContain('image/png')

    const png = await response.body()
    expect(png.length).toBeGreaterThan(0)
  })

  test('missing og route returns 404', async ({ request }) => {
    const response = await request.get('/og/does-not-exist')
    expect(response.status()).toBe(404)
  })
})

test.describe('og-image meta tags', () => {
  test('home page emits social image tags', async ({ request, baseURL }) => {
    const response = await request.get('/', {
      headers: { 'sec-fetch-dest': 'document' },
    })

    expect(response.status()).toBe(200)
    const html = await response.text()

    expect(html).toContain(`property="og:image" content="${baseURL}/og"`)
    expect(html).toContain(`name="twitter:image" content="${baseURL}/og"`)
    expect(html).toContain('name="twitter:card" content="summary_large_image"')
  })

  test('page emits page-specific social image tags', async ({ request, baseURL }) => {
    const response = await request.get('/getting-started', {
      headers: { 'sec-fetch-dest': 'document' },
    })

    expect(response.status()).toBe(200)
    const html = await response.text()

    expect(html).toContain(`property="og:image" content="${baseURL}/og/getting-started"`)
    expect(html).toContain(`name="twitter:image" content="${baseURL}/og/getting-started"`)
  })
})
