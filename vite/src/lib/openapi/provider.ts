/**
 * OpenAPI virtual tab provider.
 *
 * Implements VirtualTabProvider to generate navigation groups and virtual
 * MDX pages from OpenAPI specs. Reads the `tab.openapi` field (string or
 * string[]), processes each spec through the @scalar pipeline, and produces
 * one virtual page per endpoint grouped by tag.
 */

import fs from 'node:fs'
import path from 'node:path'
import type { OpenAPIV3 } from 'openapi-types'
import type { ConfigNavGroup } from '../../config.ts'
import type { VirtualTabProvider, VirtualTabResult } from '../virtual-tab-provider.ts'
import type { ExtractedOperation, DereferencedDocument } from './process.ts'
import { formatHolocronWarning, logger } from '../logger.ts'

type OpWithDoc = { op: ExtractedOperation; doc: DereferencedDocument }

export const openapiProvider: VirtualTabProvider = {
  name: 'openapi',
  claims: (tab) => !!tab.openapi,

  async generate({ tab, projectRoot }): Promise<VirtualTabResult> {
    const specPaths = Array.isArray(tab.openapi) ? tab.openapi! : [tab.openapi!]
    const slugPrefix = tab.openapiBase ?? 'api'
    const mdxContent: Record<string, string> = {}

    const allOps: OpWithDoc[] = []

    for (const specPath of specPaths) {
      const resolvedPath = path.resolve(projectRoot, specPath)
      if (!fs.existsSync(resolvedPath)) {
        throw new Error(`[holocron] OpenAPI spec not found: ${resolvedPath}`)
      }

      const { processOpenAPISpec, extractOperations } = await import('./process.ts')
      const processed = await processOpenAPISpec(resolvedPath)
      for (const op of extractOperations(processed)) {
        allOps.push({ op, doc: processed })
      }
    }

    if (allOps.length === 0) return { groups: [], mdxContent }

    const { operationSlug, operationTitle, tagDisplayName } = await import('./process.ts')
    const { generateCurl } = await import('./curl-generator.ts')

    // Group operations by tag (using the first tag of each operation)
    const tagGroups = new Map<string, OpWithDoc[]>()
    for (const item of allOps) {
      const tag = item.op.tags[0] ?? 'default'
      const list = tagGroups.get(tag) ?? []
      list.push(item)
      tagGroups.set(tag, list)
    }

    const groups: ConfigNavGroup[] = []

    for (const [tag, ops] of tagGroups) {
      const pages: string[] = []

      for (const { op, doc } of ops) {
        const slug = slugPrefix ? `${slugPrefix}/${operationSlug(op)}` : operationSlug(op)

        // Warn if the slug shadows a real MDX page on disk
        for (const ext of ['.mdx', '.md']) {
          if (fs.existsSync(path.join(projectRoot, slug + ext))) {
            logger.warn(formatHolocronWarning(
              `OpenAPI page "${slug}" shadows an MDX file on disk. ` +
              `The virtual OpenAPI page will be used instead.`,
            ))
            break
          }
        }

        const title = operationTitle(op)
        const curl = generateCurl(op)

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
          // Prefer application/json, fall back to any JSON-like type, then first available
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
          }
        })()

        const responses = Object.entries(op.operation.responses ?? {}).map(([status, resp]) => {
          const r = resp as OpenAPIV3.ResponseObject
          // Prefer application/json, fall back to any JSON-like type
          const jsonKey = r.content
            ? (Object.keys(r.content).find((k) => k === 'application/json')
              ?? Object.keys(r.content).find((k) => k.includes('json')))
            : undefined
          const jsonContent = jsonKey && r.content ? r.content[jsonKey] : undefined
          const example = jsonContent?.example ?? pickFirstExample(jsonContent?.examples)
          return {
            status,
            description: r.description,
            schema: jsonContent?.schema ? simplifySchema(jsonContent.schema as Record<string, unknown>) : undefined,
            example,
          }
        })

        // Use the operation's own doc for security lookups (correct for multi-spec)
        const security = extractSecurityInfo(op, doc)

        const servers = op.servers.map((s) => ({
          url: s.url,
          description: s.description,
        }))

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

        // Build response example lines if the spec provides one
        const responseWithExample = responses.find((r) => r.example !== undefined)
        const responseExampleJson = responseWithExample?.example !== undefined
          ? (typeof responseWithExample.example === 'string'
            ? responseWithExample.example
            : JSON.stringify(responseWithExample.example, null, 2))
          : undefined

        const virtualMdx = [
          '---',
          `title: "${title.replace(/"/g, '\\"')}"`,
          `description: "${(op.operation.description ?? op.operation.summary ?? '').replace(/"/g, '\\"').replace(/\n/g, ' ').slice(0, 200)}"`,
          `api: "${op.method.toUpperCase()} ${op.path}"`,
          'gridGap: 30',
          ...(op.operation.deprecated ? ['deprecated: true'] : []),
          '---',
          '',
          '<Aside full>',
          '',
          '<RequestExample>',
          '',
          '```bash',
          curl,
          '```',
          '',
          '</RequestExample>',
          '',
          ...(responseExampleJson ? [
            '<ResponseExample>',
            '',
            '```json',
            responseExampleJson,
            '```',
            '',
            '</ResponseExample>',
            '',
          ] : []),
          '</Aside>',
          '',
          `<OpenAPIEndpoint {...${propsJson}} />`,
        ].join('\n')

        mdxContent[slug] = virtualMdx
        pages.push(slug)
      }

      // Use the first doc's tag metadata for display name
      const firstDoc = ops[0]!.doc
      groups.push({
        group: tagDisplayName(tag, firstDoc),
        pages,
      })
    }

    return { groups, mdxContent }
  },
}

/* ── Helpers ─────────────────────────────────────────────────────────── */

/** Simplify a schema object for serialization (strip non-essential fields). */
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

function pickFirstExample(examples: Record<string, unknown> | undefined): unknown | undefined {
  if (!examples) return undefined
  const first = Object.values(examples)[0]
  if (first && typeof first === 'object' && 'value' in (first as Record<string, unknown>)) {
    return (first as Record<string, unknown>).value
  }
  return first
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
