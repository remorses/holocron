import { expect, test } from '@playwright/test'

test.describe('MDX imports', () => {
  test('renders named import from /snippets/', async ({ request }) => {
    const response = await request.get('/')
    expect(response.status()).toBe(200)
    const html = await response.text()
    expect(html).toContain('data-testid="greeting"')
    expect(html).toContain('Hello, ')
    expect(html).toContain('World')
  })

  test('renders default import from /snippets/', async ({ request }) => {
    const response = await request.get('/')
    expect(response.status()).toBe(200)
    const html = await response.text()
    expect(html).toContain('data-testid="alert"')
    expect(html).toContain('default-import-works')
  })

  test('renders named import from /components/', async ({ request }) => {
    const response = await request.get('/')
    expect(response.status()).toBe(200)
    const html = await response.text()
    expect(html).toContain('data-testid="custom-badge"')
    expect(html).toContain('imported')
  })

  test('renders components imported with ../ relative paths', async ({ request }) => {
    const response = await request.get('/guides/relative-imports')
    expect(response.status()).toBe(200)
    const html = await response.text()
    // Greeting imported via ../snippets/greeting
    expect(html).toContain('data-testid="greeting"')
    expect(html).toContain('Relative')
    // CustomBadge imported via ../components/custom-badge
    expect(html).toContain('data-testid="custom-badge"')
    expect(html).toContain('relative-badge')
  })

  test('index page renders all imports in browser', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Import Test Page' })).toBeVisible()
    await expect(page.getByTestId('greeting')).toBeVisible()
    await expect(page.getByTestId('greeting')).toContainText('Hello, World!')
    await expect(page.getByTestId('custom-badge')).toContainText('imported')
    await expect(page.getByTestId('alert')).toContainText('default-import-works')
  })

  test('relative imports page renders in browser', async ({ page }) => {
    await page.goto('/guides/relative-imports')
    await expect(page.getByRole('heading', { name: 'Relative Imports Page' })).toBeVisible()
    await expect(page.getByTestId('greeting')).toContainText('Hello, Relative!')
    await expect(page.getByTestId('custom-badge')).toContainText('relative-badge')
  })
})
