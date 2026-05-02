import { expect, test } from '@playwright/test'

test.describe('MDX imports', () => {
  test('renders imported component inside <Above>', async ({ request }) => {
    const response = await request.get('/')
    expect(response.status()).toBe(200)
    const html = await response.text()
    // The Greeting component imported via /snippets/greeting should resolve
    // inside <Above> because import nodes are prepended to above nodes.
    // SSR inserts React comment nodes between text fragments, so match parts.
    expect(html).toContain('Above')
    expect(html).toMatch(/Hello,.*Above.*!/)
  })

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

  test('renders default import from .md snippets', async ({ request }) => {
    const response = await request.get('/')
    expect(response.status()).toBe(200)
    const html = await response.text()
    expect(html).toContain('Plain markdown snippet imported from a `.md` file.')
  })

  test('renders imported .md file outside the Vite app root', async ({ request }) => {
    const response = await request.get('/')
    expect(response.status()).toBe(200)
    const html = await response.text()
    expect(html).toContain('Delightful docs. Mintlify drop in replacement as a Vite plugin')
  })

  test('renders nested imports inside imported .md snippets', async ({ request }) => {
    const response = await request.get('/')
    expect(response.status()).toBe(200)
    const html = await response.text()
    expect(html).toContain('Outer imported markdown body.')
    expect(html).toContain('Nested imported markdown works in the browser.')
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
    // There are now 2 greeting elements: one in <Above> and one in content.
    // Check for the content one by matching text.
    const greetings = page.getByTestId('greeting')
    await expect(greetings.filter({ hasText: 'Hello, World!' })).toBeVisible()
    await expect(greetings.filter({ hasText: 'Hello, Above!' })).toBeVisible()
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
