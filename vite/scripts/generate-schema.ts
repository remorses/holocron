/**
 * Generates vite/schema.json and vite/src/frontmatter-schema.json from Zod schemas.
 *
 * Run with: pnpm -F @holocron.so/vite generate-schema
 *
 * - schema.json: the config JSON Schema users reference from holocron.jsonc
 * - frontmatter-schema.json: the frontmatter JSON Schema for MDX page YAML frontmatter
 *
 * Uses Zod v4's `override` callback to clean up the output inline instead of
 * a recursive post-processing pass. Uses `io: "input"` for frontmatter so
 * union+transform fields (e.g. og:image:width accepting string|number) are
 * represented natively as `anyOf` without manual patching.
 */

import { z } from 'zod'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { holocronConfigSchema } from '../src/schema.ts'
import { pageFrontmatterSchema } from '../src/lib/page-frontmatter.ts'

const here = path.dirname(fileURLToPath(import.meta.url))
const schemaPath = path.join(here, '..', 'src', 'schema.json')
const frontmatterSchemaPath = path.join(here, '..', 'src', 'frontmatter-schema.json')

/**
 * Zod v4 `override` callback that cleans up two quirks inline during traversal:
 *
 * 1. Strips the duplicate `id` field Zod writes inside every named definition.
 *    The key inside `definitions/` already identifies the schema.
 *
 * 2. Unwraps `allOf: [{ $ref }]` to just `{ $ref }` when there is only a single
 *    ref and no extra metadata on the wrapper. Zod emits this wrapper whenever
 *    `.optional()` is called on a schema with `.meta({ id })`, because JSON Schema
 *    forbids siblings next to `$ref`.
 */
function cleanOverride(ctx: { jsonSchema: Record<string, unknown> }) {
  // Strip duplicate id
  if ('id' in ctx.jsonSchema) {
    delete ctx.jsonSchema.id
  }

  // Unwrap single-item allOf containing just a $ref
  const { allOf } = ctx.jsonSchema
  if (
    Array.isArray(allOf) &&
    allOf.length === 1 &&
    allOf[0] &&
    typeof allOf[0] === 'object' &&
    Object.keys(ctx.jsonSchema).length === 1
  ) {
    const inner = allOf[0] as Record<string, unknown>
    delete ctx.jsonSchema.allOf
    Object.assign(ctx.jsonSchema, inner)
  }
}

// ── Config schema ───────────────────────────────────────────────────────

const configSchema = z.toJSONSchema(holocronConfigSchema, {
  target: 'draft-7',
  metadata: z.globalRegistry,
  reused: 'inline',
  unrepresentable: 'any',
  override: cleanOverride,
})

fs.writeFileSync(schemaPath, JSON.stringify(configSchema, null, 2) + '\n')
console.log(`✓ wrote ${path.relative(process.cwd(), schemaPath)}`)

// ── Frontmatter schema ──────────────────────────────────────────────────
// io: "input" represents the schema before transforms, so z.union([string, number])
// becomes `anyOf: [{ type: "string" }, { type: "number" }]` natively.

const frontmatterOutput = z.toJSONSchema(pageFrontmatterSchema, {
  target: 'draft-7',
  unrepresentable: 'any',
  io: 'input',
})

fs.writeFileSync(frontmatterSchemaPath, JSON.stringify(frontmatterOutput, null, 2) + '\n')
console.log(`✓ wrote ${path.relative(process.cwd(), frontmatterSchemaPath)}`)
