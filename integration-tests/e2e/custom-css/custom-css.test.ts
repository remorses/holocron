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
    const varValue = await page.evaluate(() =>
      getComputedStyle(document.documentElement)
        .getPropertyValue('--custom-css-test')
        .trim(),
    )
    expect(varValue).toBeTruthy()
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
})
