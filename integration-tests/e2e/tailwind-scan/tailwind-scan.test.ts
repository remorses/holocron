/** Verifies Tailwind CSS HMR for classes added to MDX files inside pagesDir. */
import fs from 'node:fs'
import path from 'node:path'
import { expect, test } from '@playwright/test'

const fixtureRoot = path.resolve(import.meta.dirname, '../../fixtures/tailwind-scan')
const mdxFile = path.join(fixtureRoot, 'src/index.mdx')
const componentFile = path.join(fixtureRoot, 'src/components/tailwind-target.tsx')

test.describe.serial('Tailwind scans MDX classes during HMR @dev', () => {
  let originalMdx: string
  let originalComponent: string

  test.beforeEach(() => {
    originalMdx = fs.readFileSync(mdxFile, 'utf-8')
    originalComponent = fs.readFileSync(componentFile, 'utf-8')
  })

  test.afterEach(() => {
    fs.writeFileSync(mdxFile, originalMdx)
    fs.writeFileSync(componentFile, originalComponent)
  })

  test('arbitrary classes added to MDX JSX are compiled without reload', async ({ page }) => {
    await page.goto('/', { waitUntil: 'commit' })
    const target = page.locator('#tw-scan-target')
    await expect(target).toBeVisible()

    // The first dev visit can trigger Vite's optimize-deps reload. Stabilize
    // before setting the no-reload marker so this test only catches the MDX HMR
    // path, not dependency optimizer startup work.
    await page.reload({ waitUntil: 'commit' })
    await page.waitForLoadState('networkidle')
    await expect(target).toBeVisible()

    const marker = `tailwind-hmr-${Date.now()}`
    await page.evaluate((value) => {
      Object.assign(window, { __tailwindHmrMarker: value })
    }, marker)

    await expect
      .poll(async () => await target.evaluate((el) => getComputedStyle(el).padding))
      .not.toBe('37px')

    const updatedMdx = originalMdx.replace(
      '<div id="tw-scan-target">',
      '<div id="tw-scan-target" className="p-[37px] text-[#e05d44] bg-[#1a2b3c]">',
    )

    fs.writeFileSync(mdxFile, updatedMdx)

    await expect
      .poll(async () => await target.evaluate((el) => el.getAttribute('class')), {
        timeout: 15_000,
      })
      .toBe('p-[37px] text-[#e05d44] bg-[#1a2b3c]')

    await expect
      .poll(async () => await target.evaluate((el) => getComputedStyle(el).padding))
      .toBe('37px')

    await expect
      .poll(async () => await target.evaluate((el) => getComputedStyle(el).color))
      .toBe('rgb(224, 93, 68)')

    await expect
      .poll(async () => await target.evaluate((el) => getComputedStyle(el).backgroundColor))
      .toBe('rgb(26, 43, 60)')

    await expect
      .poll(async () => await page.evaluate(() => Reflect.get(window, '__tailwindHmrMarker')))
      .toBe(marker)
  })

  test('arbitrary classes added to imported React components are compiled without reload', async ({ page }) => {
    await page.goto('/', { waitUntil: 'commit' })
    const target = page.locator('#tw-component-target')
    await expect(target).toBeVisible()

    await page.reload({ waitUntil: 'commit' })
    await page.waitForLoadState('networkidle')
    await expect(target).toBeVisible()

    const marker = `tailwind-component-hmr-${Date.now()}`
    await page.evaluate((value) => {
      Object.assign(window, { __tailwindHmrMarker: value })
    }, marker)

    await expect
      .poll(async () => await target.evaluate((el) => getComputedStyle(el).padding))
      .not.toBe('41px')

    const updatedComponent = originalComponent.replace(
      '<div id="tw-component-target">',
      '<div id="tw-component-target" className="p-[41px] text-[#1f7a5f] bg-[#f2e8d5]">',
    )

    fs.writeFileSync(componentFile, updatedComponent)

    await expect
      .poll(async () => await target.evaluate((el) => el.getAttribute('class')), {
        timeout: 15_000,
      })
      .toBe('p-[41px] text-[#1f7a5f] bg-[#f2e8d5]')

    await expect
      .poll(async () => await target.evaluate((el) => getComputedStyle(el).padding))
      .toBe('41px')

    await expect
      .poll(async () => await target.evaluate((el) => getComputedStyle(el).color))
      .toBe('rgb(31, 122, 95)')

    await expect
      .poll(async () => await target.evaluate((el) => getComputedStyle(el).backgroundColor))
      .toBe('rgb(242, 232, 213)')

    await expect
      .poll(async () => await page.evaluate(() => Reflect.get(window, '__tailwindHmrMarker')))
      .toBe(marker)
  })
})
