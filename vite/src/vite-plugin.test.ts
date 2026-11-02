import fs from 'node:fs'
import path from 'node:path'
import { expect, test } from 'vitest'
import { createVitest } from 'vitest/node'
import { holocron } from './vite-plugin.ts'

function listFiles(dir: string, base = dir): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return listFiles(full, base)
    return [path.relative(base, full)]
  }).sort()
}

// Vitest overrides build.outDir with 'dummy-non-existing-folder'. Holocron
// must not treat that as a real folder and write its caches there.
test('vitest server keeps holocron caches in the Vite cache dir', async () => {
  // Inside the package so spiceflow resolves to the same copy as the plugin
  const root = fs.mkdtempSync(path.join(import.meta.dirname, '..', '.tmp-vitest-'))
  try {
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'fixture', type: 'module' }))
    fs.writeFileSync(path.join(root, 'docs.json'), JSON.stringify({
      name: 'Fixture',
      navigation: [{ group: 'Docs', pages: ['index'] }],
    }))
    fs.writeFileSync(path.join(root, 'index.mdx'), '---\ntitle: Home\n---\n\nHello\n')

    const vitest = await createVitest(
      'test',
      { root, config: false, watch: false },
      { plugins: [holocron()] },
    )
    await vitest.close()

    expect(listFiles(root)).toMatchInlineSnapshot(`
      [
        "docs.json",
        "index.mdx",
        "node_modules/.vite/vitest/da39a3ee5e6b4b0d3255bfef95601890afd80709/holocron/holocron-icons.json",
        "node_modules/.vite/vitest/da39a3ee5e6b4b0d3255bfef95601890afd80709/holocron/holocron-images.json",
        "package.json",
      ]
    `)
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})
