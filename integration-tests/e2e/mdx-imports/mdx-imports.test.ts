import { expect, test } from '@playwright/test'

test.describe('MDX imports', () => {
  test('renders components imported from /snippets/', async ({ request }) => {
    const response = await request.get('/')
    expect(response.status()).toBe(200)
    const html = await response.text()
    // Greeting component should render with the name prop
    // React SSR splits JSX text+vars with <!-- --> comments, so check parts
    expect(html).toContain('data-testid="greeting"')
    expect(html).toContain('Hello, ')
    expect(html).toContain('World')
  })

  test('renders components imported from /components/', async ({ request }) => {
    const response = await request.get('/')
    expect(response.status()).toBe(200)
    const html = await response.text()
    // CustomBadge component should render with the label prop
    expect(html).toContain('imported')
    expect(html).toContain('data-testid="custom-badge"')
  })

  test('page renders without errors', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Import Test Page' })).toBeVisible()
    await expect(page.getByTestId('greeting')).toBeVisible()
    await expect(page.getByTestId('greeting')).toContainText('Hello, World!')
    await expect(page.getByTestId('custom-badge')).toBeVisible()
    await expect(page.getByTestId('custom-badge')).toContainText('imported')
  })
})
