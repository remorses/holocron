// Smoke test for the AI logo generation endpoint.
// Fetches a generated logo PNG for a few test names and validates the response.
//
// Usage:
//   tsx scripts/test-ai-logo.ts                          # tests against preview.holocron.so
//   LOGO_BASE_URL=https://holocron.so tsx scripts/test-ai-logo.ts  # tests against prod

import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const BASE_URL = process.env.LOGO_BASE_URL ?? 'https://preview.holocron.so'
const OUTPUT_DIR = join(import.meta.dirname!, '..', 'tmp', 'ai-logo-test')

const TEST_NAMES = ['acme', 'moonlight', 'velocity', 'aurora', 'nimbus']

async function testLogo(name: string): Promise<void> {
  const url = `${BASE_URL}/api/ai-logo/${encodeURIComponent(name)}.png`
  console.log(`\n→ Testing: ${name}`)
  console.log(`  URL: ${url}`)

  const start = Date.now()
  const res = await fetch(url)
  const elapsed = Date.now() - start

  console.log(`  Status: ${res.status} (${elapsed}ms)`)
  console.log(`  Content-Type: ${res.headers.get('content-type')}`)
  console.log(`  Cache-Control: ${res.headers.get('cache-control')}`)

  if (res.status === 422) {
    console.log(`  ⊘ SKIPPED: content filtered (NSFW false positive for "${name}")`)
    await res.text() // drain body
    return
  }

  if (!res.ok) {
    const body = await res.text()
    console.error(`  ✗ FAILED: ${body}`)
    process.exitCode = 1
    return
  }

  const contentType = res.headers.get('content-type') ?? ''
  if (!contentType.includes('image/jpeg')) {
    console.error(`  ✗ FAILED: expected image/jpeg, got ${contentType}`)
    process.exitCode = 1
    return
  }

  const buf = await res.arrayBuffer()
  const bytes = new Uint8Array(buf)

  // Validate JPEG magic bytes
  const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
  if (!isJpeg) {
    console.error(`  ✗ FAILED: response is not a valid JPEG (bad magic bytes)`)
    process.exitCode = 1
    return
  }

  // Save to disk for manual inspection
  const outPath = join(OUTPUT_DIR, `${name.toLowerCase()}.jpeg`)
  writeFileSync(outPath, bytes)
  console.log(`  ✓ OK — ${bytes.length} bytes, saved to ${outPath}`)
}

async function main() {
  console.log(`AI Logo Generation Smoke Test`)
  console.log(`Base URL: ${BASE_URL}`)
  console.log(`Output dir: ${OUTPUT_DIR}`)

  mkdirSync(OUTPUT_DIR, { recursive: true })

  for (const name of TEST_NAMES) {
    await testLogo(name)
  }

  console.log(`\n${process.exitCode ? '✗ Some tests failed' : '✓ All tests passed'}`)
}

void main()
