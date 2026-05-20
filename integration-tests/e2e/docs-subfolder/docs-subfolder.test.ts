// Docs-subfolder fixture: parent app owns `/` while holocron serves docs in a
// `/docs/*` subfolder. Verifies that holocron does NOT redirect `/` to the
// first doc page when the parent has its own route for `/`.

import { expect, test } from '../helpers/test.ts'

test.describe('parent owns / while holocron serves /docs/*', () => {
  test('GET / renders the parent homepage, not a redirect', async ({ request }) => {
    const res = await request.get('/', {
      headers: { 'sec-fetch-dest': 'document' },
      maxRedirects: 0,
    })
    // Should NOT be a 307 redirect to /docs/getting-started
    expect(res.status()).toBe(200)
    const body = await res.text()
    expect(body).toContain('Product Homepage')
  })

  test('browser loads the parent homepage at /', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await expect(page).toHaveTitle('Product Homepage')
    await expect(page.locator('[data-homepage="yes"]')).toBeVisible()
    await expect(
      page.getByRole('heading', { name: 'Welcome to the Product' }),
    ).toBeVisible()
  })

  test('GET /docs/getting-started renders holocron docs', async ({ page }) => {
    await page.goto('/docs/getting-started', { waitUntil: 'domcontentloaded' })
    await expect(page).toHaveTitle(/Getting Started/)
    await expect(
      page.getByRole('heading', { name: 'Getting Started' }),
    ).toBeVisible()
  })

  test('GET /docs/configuration renders holocron docs', async ({ page }) => {
    await page.goto('/docs/configuration', { waitUntil: 'domcontentloaded' })
    await expect(page).toHaveTitle(/Configuration/)
    await expect(
      page.getByRole('heading', { name: 'Configuration' }),
    ).toBeVisible()
  })
})
