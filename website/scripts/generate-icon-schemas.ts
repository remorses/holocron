/**
 * Generates lightweight JSON Schema files containing only icon name enums
 * (no SVG bodies) from @iconify-json packages. These are imported by
 * server.tsx and served at /schemas/lucide-icons.json and
 * /schemas/fontawesome-icons.json for external $ref resolution by IDEs.
 *
 * Run: tsx scripts/generate-icon-schemas.ts
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { icons as lucideIcons } from '@iconify-json/lucide'
import { icons as fa6BrandsIcons } from '@iconify-json/fa6-brands'
import { icons as fa6RegularIcons } from '@iconify-json/fa6-regular'
import { icons as fa6SolidIcons } from '@iconify-json/fa6-solid'

const here = path.dirname(fileURLToPath(import.meta.url))
const outDir = path.join(here, '..', 'src', 'generated')
fs.mkdirSync(outDir, { recursive: true })

const lucideSchema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'string',
  description: 'Lucide icon name with "lucide:" prefix (https://lucide.dev/icons/)',
  enum: [
    ...Object.keys(lucideIcons.icons).map((n) => `lucide:${n}`),
    ...Object.keys(lucideIcons.aliases || {}).map((n) => `lucide:${n}`),
  ].sort(),
}

const faSchema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'string',
  description: 'Font Awesome 6 icon name with "fontawesome:{style}:" prefix',
  enum: [
    ...Object.keys(fa6SolidIcons.icons).map((n) => `fontawesome:solid:${n}`),
    ...Object.keys(fa6BrandsIcons.icons).map((n) => `fontawesome:brands:${n}`),
    ...Object.keys(fa6RegularIcons.icons).map((n) => `fontawesome:regular:${n}`),
  ].sort(),
}

const lucidePath = path.join(outDir, 'lucide-icons-schema.json')
const faPath = path.join(outDir, 'fontawesome-icons-schema.json')

fs.writeFileSync(lucidePath, JSON.stringify(lucideSchema, null, 2) + '\n')
fs.writeFileSync(faPath, JSON.stringify(faSchema, null, 2) + '\n')

console.log(`✓ wrote ${path.relative(process.cwd(), lucidePath)} (${lucideSchema.enum.length} icons)`)
console.log(`✓ wrote ${path.relative(process.cwd(), faPath)} (${faSchema.enum.length} icons)`)
