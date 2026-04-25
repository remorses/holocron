/**
 * Generate sample values from JSON Schema / OpenAPI schema objects.
 *
 * Produces realistic example values for request/response bodies by
 * walking the schema tree. Handles objects, arrays, primitives, enums,
 * allOf/oneOf/anyOf, $ref (expects dereferenced input), and common
 * string formats (email, date-time, uuid, uri, etc.).
 *
 * Inspired by fumadocs openapi (MIT) and openapi-sampler.
 */

type SchemaDoc = Record<string, unknown>

const MAX_DEPTH = 10

function inferType(schema: SchemaDoc): string | null {
  if (schema.type !== undefined) {
    const t = schema.type
    return Array.isArray(t) ? (t.length > 0 ? String(t[0]) : null) : String(t)
  }
  if (schema.properties || schema.additionalProperties) return 'object'
  if (schema.items) return 'array'
  if (schema.enum) return 'string'
  return null
}

function inferExample(schema: SchemaDoc): unknown | undefined {
  if (schema.const !== undefined) return schema.const
  if (schema.example !== undefined) return schema.example
  if (Array.isArray(schema.examples) && schema.examples.length > 0) return schema.examples[0]
  if (Array.isArray(schema.enum) && schema.enum.length > 0) return schema.enum[0]
  if (schema.default !== undefined) return schema.default
  return undefined
}

function sampleString(schema: SchemaDoc): string {
  const format = (schema.format as string | undefined) || 'default'
  const formats: Record<string, () => string> = {
    email: () => 'user@example.com',
    'date-time': () => '2024-01-15T09:30:00Z',
    date: () => '2024-01-15',
    time: () => '09:30:00Z',
    uri: () => 'https://example.com',
    url: () => 'https://example.com',
    uuid: () => '550e8400-e29b-41d4-a716-446655440000',
    ipv4: () => '192.168.1.1',
    ipv6: () => '2001:0db8:85a3::8a2e:0370:7334',
    hostname: () => 'example.com',
    password: () => 'pa$$word',
    binary: () => '<binary>',
    byte: () => 'dGVzdA==',
    default: () => 'string',
  }
  const fn = formats[format] ?? formats.default!
  return fn()
}

function sampleNumber(schema: SchemaDoc): number {
  if (typeof schema.minimum === 'number') return schema.minimum as number
  if (typeof schema.exclusiveMinimum === 'number') return (schema.exclusiveMinimum as number) + 1
  if (typeof schema.maximum === 'number') return schema.maximum as number
  if (schema.type === 'number' && (schema.format === 'float' || schema.format === 'double')) return 0.1
  return 0
}

function sampleObject(schema: SchemaDoc, depth: number): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  const properties = schema.properties as Record<string, SchemaDoc> | undefined
  if (!properties) return result

  for (const [key, propSchema] of Object.entries(properties)) {
    if (!propSchema || typeof propSchema !== 'object') continue
    result[key] = traverse(propSchema, depth + 1)
  }

  return result
}

function sampleArray(schema: SchemaDoc, depth: number): unknown[] {
  const items = schema.items as SchemaDoc | undefined
  if (!items) return []
  const count = Math.min(
    typeof schema.maxItems === 'number' ? schema.maxItems : Infinity,
    typeof schema.minItems === 'number' ? schema.minItems : 1,
  )
  const result: unknown[] = []
  for (let i = 0; i < Math.max(count, 1); i++) {
    result.push(traverse(items, depth + 1))
  }
  return result
}

function traverse(schema: unknown, depth = 0): unknown {
  if (depth > MAX_DEPTH) return undefined
  if (!schema || typeof schema !== 'object') return schema

  const s = schema as SchemaDoc

  // Check for explicit example first
  const example = inferExample(s)
  if (example !== undefined) return example

  // allOf: merge properties
  if (Array.isArray(s.allOf) && s.allOf.length > 0) {
    const merged: SchemaDoc = { ...s, allOf: undefined }
    for (const sub of s.allOf) {
      if (sub && typeof sub === 'object') {
        const subDoc = sub as SchemaDoc
        if (subDoc.properties && typeof subDoc.properties === 'object') {
          merged.properties = { ...(merged.properties as Record<string, unknown> || {}), ...(subDoc.properties as Record<string, unknown>) }
        }
        if (Array.isArray(subDoc.required)) {
          merged.required = [...(Array.isArray(merged.required) ? merged.required : []), ...subDoc.required]
        }
        if (subDoc.type && !merged.type) merged.type = subDoc.type
      }
    }
    return traverse(merged, depth)
  }

  // oneOf / anyOf: use first variant
  const union = (s.oneOf ?? s.anyOf) as SchemaDoc[] | undefined
  if (Array.isArray(union) && union.length > 0) {
    return traverse(union[0], depth)
  }

  const type = inferType(s)

  switch (type) {
    case 'object': return sampleObject(s, depth)
    case 'array': return sampleArray(s, depth)
    case 'string': return sampleString(s)
    case 'integer':
    case 'number': return sampleNumber(s)
    case 'boolean': return true
    case 'null': return null
    default: return undefined
  }
}

/**
 * Generate a sample value from a JSON Schema / OpenAPI schema object.
 * Expects a fully dereferenced schema (no $ref pointers).
 */
export function sample(schema: Record<string, unknown>): unknown {
  return traverse(schema)
}
