/**
 * Generates vite/schema.json from the Zod schemas defined in src/schema.ts.
 *
 * Run with: pnpm -F @holocron.so/vite generate-schema
 *
 * The generated schema.json is the JSON Schema that users reference from
 * their holocron.jsonc (via `"$schema": "..."`) to get IDE autocomplete
 * and validation.
 */

import { z } from 'zod'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { holocronConfigSchema } from '../src/schema.ts'

const here = path.dirname(fileURLToPath(import.meta.url))
const schemaPath = path.join(here, '..', 'schema.json')

// Register the root schema in the global registry so `metadata` extracts
// all schemas with `.meta({ id })` into top-level definitions.
const generated = z.toJSONSchema(holocronConfigSchema, {
  target: 'draft-7',
  metadata: z.globalRegistry,
  reused: 'inline',
  unrepresentable: 'any',
})

/**
 * Post-processing:
 *
 * 1. Strip the duplicate `id` field Zod writes inside every named
 *    definition. The key inside `definitions/` already identifies the
 *    schema, so the inner `id` is noise.
 *
 * 2. Unwrap `allOf: [{ $ref }]` → just `{ $ref }` when there is only
 *    a single ref and no extra metadata on the wrapper. Zod emits this
 *    wrapper whenever `.optional()` is called on a schema that has an
 *    `id`, because JSON Schema forbids siblings next to `$ref`.
 */
function clean(node: unknown): unknown {
  if (Array.isArray(node)) {
    return node.map(clean)
  }
  if (node === null || typeof node !== 'object') {
    return node
  }
  const obj = node as Record<string, unknown>

  // Unwrap single-item allOf containing just a $ref + nothing else
  if (
    Array.isArray(obj.allOf) &&
    obj.allOf.length === 1 &&
    obj.allOf[0] &&
    typeof obj.allOf[0] === 'object' &&
    Object.keys(obj).length === 1
  ) {
    return clean(obj.allOf[0])
  }

  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(obj)) {
    if (key === 'id') continue
    result[key] = clean(value)
  }
  return result
}

const cleaned = clean(generated) as Record<string, unknown>

// Zod emits draft-2020-12 style `$defs` by default. For draft-07 output
// with `target: 'draft-7'`, it uses `definitions` — keep as-is.
// Prepend the draft-07 `$schema` meta so downstream tooling targets the
// correct validator.
const output: Record<string, unknown> = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  ...cleaned,
}

fs.writeFileSync(schemaPath, JSON.stringify(output, null, 2) + '\n')
console.log(`✓ wrote ${path.relative(process.cwd(), schemaPath)}`)
