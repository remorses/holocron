import { expect, test, type APIResponse } from '@playwright/test'

async function expectGeneratedLogoResponse(response: APIResponse) {
  expect(response.status()).toBe(200)
  expect(response.headers()['content-type']).toContain('image/png')
  expect(response.headers()['cache-control']).toContain('immutable')
}

test.describe('generated logo route', () => {
  test('returns a cached png for the light theme', async ({ request }) => {
    const response = await request.get('/holocron-api/logo/light/test%20docs.png')

    await expectGeneratedLogoResponse(response)

    const png = await response.body()
    expect(Array.from(png.subarray(0, 4))).toEqual([137, 80, 78, 71])
  })

  test('returns a cached png for the dark theme', async ({ request }) => {
    const response = await request.get('/holocron-api/logo/dark/test%20docs.png')
    await expectGeneratedLogoResponse(response)
  })
})

test.describe('generated logo fallback', () => {
  test('home page html uses generated light and dark logo images', async ({ request }) => {
    const response = await request.get('/', {
      headers: { 'sec-fetch-dest': 'document' },
    })

    expect(response.status()).toBe(200)
    const html = await response.text()

    expect(html).toContain('/holocron-api/logo/light/test%20docs.png')
    expect(html).toContain('/holocron-api/logo/dark/test%20docs.png')
  })
})
