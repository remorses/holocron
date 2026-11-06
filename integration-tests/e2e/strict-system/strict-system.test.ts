import { expect, test } from '../helpers/test.ts'

const isDark = () => document.documentElement.classList.contains('dark')

test('strict system theme follows OS color scheme changes while the page is open', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' })
  await page.goto('/')
  await expect.poll(() => page.evaluate(isDark)).toBe(false)

  await page.emulateMedia({ colorScheme: 'dark' })
  await expect.poll(() => page.evaluate(isDark)).toBe(true)

  await page.emulateMedia({ colorScheme: 'light' })
  await expect.poll(() => page.evaluate(isDark)).toBe(false)
})
