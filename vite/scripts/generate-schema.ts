/**
 * Generates vite/schema.json and vite/src/frontmatter-schema.json from Zod schemas.
 *
 * Run with: pnpm -F @holocron.so/vite generate-schema
 *
 * - schema.json: the config JSON Schema users reference from holocron.jsonc
 * - frontmatter-schema.json: the frontmatter JSON Schema for MDX page YAML frontmatter
 *
 * Uses Zod v4's `override` to strip redundant `id` from definitions, and
 * `io: "input"` for frontmatter so union+transform fields (e.g. og:image:width
 * accepting string|number) are represented natively as `anyOf`.
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
 * Zod v4 copies all `.meta()` fields into the JSON Schema output, including the
 * `id` used as the definition key. This is intentional (see colinhacks/zod#4578)
 * but redundant since the key inside `definitions/` already identifies the schema.
 * The Zod author recommends stripping it with `override`.
 */
function stripMetaId(ctx: { jsonSchema: Record<string, unknown> }) {
  if ('id' in ctx.jsonSchema) {
    delete ctx.jsonSchema.id
  }
}

// ── Config schema ───────────────────────────────────────────────────────

const configSchema = z.toJSONSchema(holocronConfigSchema, {
  target: 'draft-7',
  metadata: z.globalRegistry,
  reused: 'inline',
  unrepresentable: 'any',
  override: stripMetaId,
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
