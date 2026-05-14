import { expect, test } from '@playwright/test'

test.describe('custom CSS injection', () => {
  test('user global.css is loaded and applies styles', async ({ page }) => {
    await page.goto('/', { waitUntil: 'commit' })
    const target = page.locator('#custom-css-target')
    await expect(target).toBeVisible()

    // The user's global.css sets font-weight: 700 on #custom-css-target.
    // Verify the computed style to confirm the CSS was injected.
    await expect
      .poll(async () => await target.evaluate((el) => getComputedStyle(el).fontWeight))
      .toBe('700')
  })

  test('user CSS variable is available', async ({ page }) => {
    await page.goto('/', { waitUntil: 'commit' })

    // The user's global.css defines --custom-css-test on :root.
    // Just verify the variable is defined (non-empty). Don't assert the
    // exact color value — browsers normalize hex colors inconsistently.
    await expect
      .poll(async () =>
        await page.evaluate(() =>
          getComputedStyle(document.documentElement)
            .getPropertyValue('--custom-css-test')
            .trim(),
        ),
      )
      .toBeTruthy()
  })

  test('HTML response includes page content', async ({ request }) => {
    const response = await request.get('/', {
      headers: { 'sec-fetch-dest': 'document' },
    })
    expect(response.status()).toBe(200)
    const html = await response.text()
    expect(html).toContain('Custom CSS')
    expect(html).toContain('custom-css-target')
  })

  test('sidebar search finds headings on the only index page', async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1200 })
    await page.goto('/', { waitUntil: 'domcontentloaded' })

    const searchInput = page.getByPlaceholder(/search/i)
    await expect(searchInput).toBeVisible({ timeout: 10000 })
    await page.reload()
    await expect(searchInput).toBeVisible({ timeout: 10000 })
    await searchInput.fill('Runtime Styles')

    const nav = page.getByRole('navigation', { name: 'Navigation' })
    await expect(nav.getByRole('link', { name: 'Runtime Styles' })).toBeVisible()
    await expect(nav.getByText('No results for', { exact: false })).not.toBeVisible()
  })
})
