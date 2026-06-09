/**
 * HMR tests: verify that editing MDX and user .tsx files updates the
 * Remotion Player content without a full page reload.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { test, expect } from '@playwright/test'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const componentsPath = path.join(root, 'components.tsx')
const mdxPath = path.join(root, 'video.mdx')

test.describe.serial('video HMR @dev', () => {
  let originalComponents: string
  let originalMdx: string

  test.beforeAll(() => {
    originalComponents = fs.readFileSync(componentsPath, 'utf-8')
    originalMdx = fs.readFileSync(mdxPath, 'utf-8')
  })

  test.afterAll(() => {
    fs.writeFileSync(componentsPath, originalComponents)
    fs.writeFileSync(mdxPath, originalMdx)
  })

  test('editing MDX text updates the Player content', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('h1')).toHaveText('Video Preview')

    // The Opening section shows "Holocron" via <BlurReveal text="Holocron" />
    // Verify it's in the Player's rendered HTML
    const playerContainer = page.locator('[style*="aspect-ratio"]').first()
    await expect(playerContainer).toBeVisible()
    await expect(playerContainer.locator('text=Holocron')).toBeVisible({ timeout: 5000 })

    // Set HMR marker
    await page.evaluate(() => { (window as any).__hmr_marker = true })

    // Edit MDX: change "Holocron" to "HMR Test Title"
    const updatedMdx = originalMdx.replace(
      '<BlurReveal text="Holocron" />',
      '<BlurReveal text="HMR Test Title" />',
    )

    await expect.poll(async () => {
      fs.writeFileSync(mdxPath, updatedMdx + `\n{/* hmr ${Date.now()} */}`)
      const markerAlive = await page.evaluate(() => (window as any).__hmr_marker === true)
      if (!markerAlive) return 'full-reload'
      const visible = await playerContainer.locator('text=HMR Test Title').isVisible().catch(() => false)
      return visible ? 'updated' : 'waiting'
    }, { timeout: 15_000, message: 'MDX HMR: new text did not appear in Player' }).toBe('updated')
  })

  test('editing component file does not cause full page reload', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('h1')).toHaveText('Video Preview')

    // Set HMR marker
    await page.evaluate(() => { (window as any).__hmr_marker = true })

    // Edit components.tsx: change the grid gap
    const updatedComponents = originalComponents.replace(
      'gap: 16,',
      'gap: 32,',
    )

    await expect.poll(async () => {
      fs.writeFileSync(componentsPath, updatedComponents + `\n// hmr ${Date.now()}`)
      const markerAlive = await page.evaluate(() => (window as any).__hmr_marker === true)
      if (!markerAlive) return 'full-reload'
      return 'ok'
    }, { timeout: 10_000, message: 'Component edit caused a full page reload' }).toBe('ok')
  })
})
