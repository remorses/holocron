import fs from 'node:fs'
import path from 'node:path'
import { expect, test } from '@playwright/test'

const fixtureRoot = path.resolve(import.meta.dirname, '../../fixtures/mdx-imports')

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
    expect(html).toContain('Plain markdown snippet imported from a ')
    expect(html).toContain('>.md</code>')
    expect(html).toContain(' file.')
  })

  test('imported .md gets build-time image processing (dimensions + placeholder)', async ({ request }) => {
    const response = await request.get('/')
    expect(response.status()).toBe(200)
    const html = await response.text()
    // The image in plain-markdown.md should have been processed by the
    // build-time pipeline: converted from markdown img to <Image> with
    // width, height, and placeholder attributes.
    expect(html).toMatch(/width="16"/)
    expect(html).toMatch(/height="8"/)
  })

  test('imported .md gets remark plugin processing (github callouts)', async ({ request }) => {
    const response = await request.get('/')
    expect(response.status()).toBe(200)
    const html = await response.text()
    // The > [!NOTE] callout in plain-markdown.md should be transformed
    // by the remark-github-callouts plugin into a Note component.
    expect(html).toContain('This callout should be processed by remark plugins')
  })

  test('renders imported .md file outside the Vite app root', async ({ request }) => {
    const response = await request.get('/')
    expect(response.status()).toBe(200)
    const html = await response.text()
    expect(html).toContain('Delightful docs. Mintlify drop in replacement as a Vite plugin')
  })

  test('renders imported .md from outside pagesDir via ../', async ({ request }) => {
    const response = await request.get('/')
    expect(response.status()).toBe(200)
    const html = await response.text()
    expect(html).toContain('This snippet lives outside the pagesDir boundary')
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

  test('renders ?raw import as raw string content', async ({ request }) => {
    const response = await request.get('/')
    expect(response.status()).toBe(200)
    const html = await response.text()
    expect(html).toContain('data-testid="raw-import"')
    expect(html).toContain('hello from python')
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

test.describe.serial('imported .md HMR @dev', () => {
  const mdFile = path.join(fixtureRoot, 'snippets/plain-markdown.md')
  let originalContent: string

  test.beforeEach(() => {
    originalContent = fs.readFileSync(mdFile, 'utf-8')
  })

  test.afterEach(() => {
    fs.writeFileSync(mdFile, originalContent)
  })

  test('editing an imported .md file updates the page via HMR', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Import Test Page' })).toBeVisible({ timeout: 10_000 })

    // Verify initial content is rendered
    await expect(page.getByText('Plain markdown snippet imported from a')).toBeVisible()
    await expect(page.getByText('HMR injected imported markdown')).not.toBeVisible()

    // Mutate the imported .md file — should trigger re-sync + HMR update
    await expect
      .poll(async () => {
        const updated = originalContent + `\nHMR injected imported markdown paragraph ${Date.now()}.\n`
        fs.writeFileSync(mdFile, updated)
        return await page.getByText('HMR injected imported markdown').isVisible()
      }, { timeout: 15_000 })
      .toBe(true)
  })
})

test.describe.serial('imported .md outside pagesDir HMR @dev', () => {
  // This file lives outside the fixture root (pagesDir), imported via ../
  const outsideFile = path.resolve(fixtureRoot, '../outside-pagesdir-snippet.md')
  let originalContent: string

  test.beforeEach(() => {
    originalContent = fs.readFileSync(outsideFile, 'utf-8')
  })

  test.afterEach(() => {
    fs.writeFileSync(outsideFile, originalContent)
  })

  test('editing an imported .md outside pagesDir triggers HMR', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Import Test Page' })).toBeVisible({ timeout: 10_000 })

    // Verify the outside snippet is rendered
    await expect(page.getByText('This snippet lives outside the pagesDir boundary')).toBeVisible()
    await expect(page.getByText('HMR outside pagesDir update')).not.toBeVisible()

    // Mutate the file outside pagesDir — watcher should pick it up
    await expect
      .poll(async () => {
        const updated = originalContent + `\nHMR outside pagesDir update ${Date.now()}.\n`
        fs.writeFileSync(outsideFile, updated)
        return await page.getByText('HMR outside pagesDir update').isVisible()
      }, { timeout: 15_000 })
      .toBe(true)
  })
})
