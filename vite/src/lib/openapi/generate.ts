/**
 * Standalone OpenAPI page generator for multi-tenant pipelines.
 *
 * Takes an OpenAPI spec as a string or parsed object and produces MDX pages
 * + navigation groups without filesystem access. Reuses the same processing
 * pipeline as the Vite plugin's openapiProvider, so the output is identical
 * to a full build.
 *
 * Usage (from Notaku or any external pipeline):
 *
 *   import { generateOpenAPIPages } from '@holocron.so/vite'
 *
 *   const { pages, navigation } = await generateOpenAPIPages({
 *     spec: yamlString,
 *     slugPrefix: 'api',
 *   })
 *   // pages: Record<string, string> — slug → MDX string
 *   // navigation: ConfigNavGroup[] — tag-grouped sidebar entries
 */

import type { ConfigNavGroup } from '../../config.ts'
import type { DereferencedDocument, ExtractedOperation } from './process.ts'
import { buildVirtualPageMdx } from '../virtual-page-mdx.ts'
import { endpointKey } from './endpoint-ref.ts'

type OpWithDoc = { op: ExtractedOperation; doc: DereferencedDocument }

export interface GenerateOpenAPIPagesOptions {
  /** Raw OpenAPI spec content (YAML or JSON string), a URL, or a parsed object. */
  spec: string | object
  /** Slug prefix for generated pages (default: 'api'). */
  slugPrefix?: string
}

export interface GenerateOpenAPIPagesResult {
  /** Map of slug → MDX string for each generated endpoint page. */
  pages: Record<string, string>
  /** Navigation groups organized by tag, ready to merge into docs.json tabs. */
  navigation: ConfigNavGroup[]
}

/**
 * Generate MDX pages and navigation from an OpenAPI spec.
 * No filesystem access needed; works with in-memory spec content.
 */
export async function generateOpenAPIPages({
  spec,
  slugPrefix = 'api',
}: GenerateOpenAPIPagesOptions): Promise<GenerateOpenAPIPagesResult> {
  const { processOpenAPISpec, extractOperations, operationSlug, operationTitle, operationSidebarTitle, tagDisplayName } = await import('./process.ts')
  const { generateCurl } = await import('./curl-generator.ts')

  // processOpenAPISpec accepts string (path/URL) or object (parsed spec).
  // For in-memory YAML/JSON strings, parse first so @scalar/bundle skips I/O.
  let input: string | object = spec
  if (typeof spec === 'string') {
    // Try parsing as JSON; if it fails, it might be YAML.
    try {
      input = JSON.parse(spec)
    } catch {
      const { parse } = await import('yaml')
      input = parse(spec) as object
    }
  }

  const processed = await processOpenAPISpec(input)
  const operations = extractOperations(processed)

  if (operations.length === 0) {
    return { pages: {}, navigation: [] }
  }

  const pages: Record<string, string> = {}
  const emitted = new Map<string, OpWithDoc>()

  const emitEndpoint = (item: OpWithDoc): string => {
    const { op, doc } = item
    const slug = slugPrefix ? `${slugPrefix}/${operationSlug(op)}` : operationSlug(op)
    const existing = emitted.get(slug)
    if (existing) {
      if (existing === item) return slug
      throw new Error(
        `Two OpenAPI operations map to the same slug "${slug}": ` +
        `${existing.op.method.toUpperCase()} ${existing.op.path} and ` +
        `${op.method.toUpperCase()} ${op.path}.`,
      )
    }
    emitted.set(slug, item)

    pages[slug] = buildEndpointMdx({
      op,
      doc,
      title: operationTitle(op),
      sidebarTitle: operationSidebarTitle(op),
      curl: generateCurl(op),
    })
    return slug
  }

  // Group by first tag (same as openapiProvider dedicated mode).
  const tagGroups = new Map<string, OpWithDoc[]>()
  for (const op of operations) {
    const item: OpWithDoc = { op, doc: processed }
    const tag = op.tags[0] ?? 'default'
    const list = tagGroups.get(tag) ?? []
    list.push(item)
    tagGroups.set(tag, list)
  }

  const navigation: ConfigNavGroup[] = []
  for (const [tag, ops] of tagGroups) {
    navigation.push({
      group: tagDisplayName(tag, ops[0]!.doc),
      pages: ops.map((item) => emitEndpoint(item)),
    })
  }

  return { pages, navigation }
}

// ── MDX builder (extracted from provider.ts to avoid circular dep) ────

import type { OpenAPIV3 } from 'openapi-types'

function buildEndpointMdx({
  op,
  doc,
  title,
  sidebarTitle,
  curl,
}: {
  op: ExtractedOperation
  doc: DereferencedDocument
  title: string
  sidebarTitle: string
  curl: string
}): string {
  const params = op.parameters.map((p) => ({
    name: p.name,
    in: p.in,
    required: p.required,
    deprecated: p.deprecated,
    description: p.description,
    schema: p.schema ? simplifySchema(p.schema as Record<string, unknown>) : undefined,
  }))

  const requestBody = (() => {
    const body = op.operation.requestBody as OpenAPIV3.RequestBodyObject | undefined
    if (!body?.content) return undefined
    const jsonKey = Object.keys(body.content).find((k) => k === 'application/json')
      ?? Object.keys(body.content).find((k) => k.includes('json'))
      ?? Object.keys(body.content)[0]
    if (!jsonKey) return undefined
    const media = body.content[jsonKey]!
    return {
      required: body.required,
      description: body.description,
      contentType: jsonKey,
      schema: media.schema ? simplifySchema(media.schema as Record<string, unknown>) : undefined,
      examples: collectExamples(media),
    }
  })()

  const responses = Object.entries(op.operation.responses ?? {}).map(([status, resp]) => {
    const r = resp as OpenAPIV3.ResponseObject
    const jsonKey = r.content
      ? (Object.keys(r.content).find((k) => k === 'application/json')
        ?? Object.keys(r.content).find((k) => k.includes('json')))
      : undefined
    const jsonContent = jsonKey && r.content ? r.content[jsonKey] : undefined
    const examples = collectExamples(jsonContent)
    return {
      status,
      description: r.description,
      schema: jsonContent?.schema ? simplifySchema(jsonContent.schema as Record<string, unknown>) : undefined,
      example: examples[0]?.value,
      examples,
    }
  })

  const security = extractSecurityInfo(op, doc)
  const servers = op.servers.map((s) => ({ url: s.url, description: s.description }))

  const propsJson = JSON.stringify({
    method: op.method,
    path: op.path,
    summary: op.operation.summary,
    description: op.operation.description,
    parameters: params,
    requestBody,
    responses,
    security,
    servers,
    deprecated: op.operation.deprecated,
  })

  const requestExampleBlocks: string[] = [
    '```bash title="cURL" lines=false',
    curl,
    '```',
  ]
  if (requestBody?.examples && requestBody.examples.length > 0) {
    requestExampleBlocks.push(...exampleCodeBlocks(requestBody.examples))
  }

  const responsesWithExamples = responses.filter((r) => r.examples.length > 0)
  const prefixStatus = responsesWithExamples.length > 1
  const responseExampleBlocks = responsesWithExamples.flatMap((r) =>
    prefixStatus
      ? exampleCodeBlocks(r.examples.map((ex) => ({ ...ex, name: `${r.status} — ${ex.name}` })))
      : exampleCodeBlocks(r.examples),
  )

  const wrap = (tag: string, blocks: string[]): string[] => [`<${tag}>`, '', ...blocks, '', `</${tag}>`]

  const aside = [
    ...wrap('RequestExample', requestExampleBlocks),
    ...(responseExampleBlocks.length > 0
      ? ['', ...wrap('ResponseExample', responseExampleBlocks)]
      : []),
  ].join('\n')

  return buildVirtualPageMdx({
    frontmatter: {
      title,
      ...(sidebarTitle !== title ? { sidebarTitle } : {}),
      description: plainText(op.operation.description ?? op.operation.summary ?? '').slice(0, 200),
      api: `${op.method.toUpperCase()} ${op.path}`,
      gridGap: 30,
      ...(op.operation.deprecated ? { deprecated: true } : {}),
    },
    aside,
    body: `<OpenAPIEndpoint {...${propsJson}} />`,
  })
}

// ── Helpers (copied from provider.ts to keep generate.ts standalone) ──

function plainText(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/(\*\*|__|\*|_)/g, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function simplifySchema(schema: Record<string, unknown>): Record<string, unknown> {
  if (!schema || typeof schema !== 'object') return schema
  const result: Record<string, unknown> = {}
  const keepKeys = ['type', 'format', 'description', 'required', 'properties', 'items',
    'enum', 'default', 'example', 'oneOf', 'anyOf', 'allOf', 'additionalProperties',
    'nullable', 'deprecated', 'minimum', 'maximum', 'minLength', 'maxLength', 'pattern', 'title']
  for (const key of keepKeys) {
    if (key in schema) {
      const value = schema[key]
      if (key === 'properties' && value && typeof value === 'object') {
        const props: Record<string, unknown> = {}
        for (const [k, v] of Object.entries(value)) {
          props[k] = simplifySchema(v as Record<string, unknown>)
        }
        result[key] = props
      } else if (key === 'items' && value && typeof value === 'object') {
        result[key] = simplifySchema(value as Record<string, unknown>)
      } else if ((key === 'oneOf' || key === 'anyOf' || key === 'allOf') && Array.isArray(value)) {
        result[key] = value.map((v: unknown) => simplifySchema(v as Record<string, unknown>))
      } else {
        result[key] = value
      }
    }
  }
  return result
}

interface NamedExample { name: string; value: unknown }

function collectExamples(
  media: { example?: unknown; examples?: Record<string, unknown> } | undefined,
): NamedExample[] {
  if (!media) return []
  const out: NamedExample[] = []
  if (media.examples && typeof media.examples === 'object') {
    for (const [name, raw] of Object.entries(media.examples)) {
      if (raw && typeof raw === 'object') {
        const obj = raw as Record<string, unknown>
        if ('value' in obj) out.push({ name, value: obj.value })
        else if (!('externalValue' in obj)) out.push({ name, value: raw })
        continue
      }
      out.push({ name, value: raw })
    }
  }
  if (media.example !== undefined && out.length === 0) {
    out.push({ name: 'Example', value: media.example })
  }
  return out
}

function fenceTitle(name: string): string {
  return name
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/`/g, "'")
    .replace(/[\r\n]+/g, ' ')
}

function exampleCodeBlocks(examples: NamedExample[]): string[] {
  return examples.flatMap((ex) => {
    const json = typeof ex.value === 'string'
      ? ex.value
      : JSON.stringify(ex.value, null, 2)
    return [`\`\`\`json title="${fenceTitle(ex.name)}" lines=false`, json, '```']
  })
}

function extractSecurityInfo(
  op: ExtractedOperation,
  doc: DereferencedDocument,
): { name: string; type: string; scheme?: string; in?: string; description?: string }[] {
  const schemes = (doc.dereferenced.components as Record<string, unknown> | undefined)?.securitySchemes as Record<string, Record<string, unknown>> | undefined
  if (!schemes || op.security.length === 0) return []
  const result: { name: string; type: string; scheme?: string; in?: string; description?: string }[] = []
  for (const req of op.security) {
    for (const schemeName of Object.keys(req)) {
      const scheme = schemes[schemeName]
      if (!scheme) continue
      result.push({
        name: schemeName,
        type: scheme.type as string,
        scheme: scheme.scheme as string | undefined,
        in: scheme.type === 'apiKey' ? (scheme.in as string) : scheme.type === 'http' ? 'header' : undefined,
        description: scheme.description as string | undefined,
      })
    }
  }
  return result
}
