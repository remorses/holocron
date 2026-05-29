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
import type { ConfigNavGroup, ConfigNavPageEntry } from '../../config.ts'
import type { VirtualTabProvider, VirtualTabResult } from '../virtual-tab-provider.ts'
import type { ExtractedOperation, DereferencedDocument } from './process.ts'
import { formatHolocronWarning, logger } from '../logger.ts'
import { parseEndpointRef, endpointKey } from './endpoint-ref.ts'

type OpWithDoc = { op: ExtractedOperation; doc: DereferencedDocument }

/** Internal marker spliced in place of the author's `"..."` entry during the
 *  first pass, then replaced with auto-generated tag groups in the second pass.
 *  A unique frozen object so it is compared by reference (`p === REST_PLACEHOLDER`)
 *  and can never collide with a real, value-equal page entry. It is a valid
 *  `ConfigNavGroup` shape only so it type-checks inside the entries array; it is
 *  always removed before the result is returned. */
const REST_PLACEHOLDER: ConfigNavGroup = Object.freeze({ group: '', pages: [] })

export const openapiProvider: VirtualTabProvider = {
  name: 'openapi',
  claims: (tab) => !!tab.openapi,

  async generate({ tab, projectRoot, pagesDir }): Promise<VirtualTabResult> {
    const specPaths = Array.isArray(tab.openapi) ? tab.openapi! : [tab.openapi!]
    const slugPrefix = tab.openapiBase ?? 'api'
    const mdxContent: Record<string, string> = {}

    const allOps: OpWithDoc[] = []
    // Per-spec lookup so the `specfile METHOD /path` form can target a spec.
    const opsBySpecFile = new Map<string, Map<string, OpWithDoc>>()

    const { processOpenAPISpec, extractOperations } = await import('./process.ts')

    for (const specPath of specPaths) {
      // Probe pagesDir first (handles pagesDir: './src' with spec inside src/),
      // fall back to projectRoot. Same resolution strategy as MDX imports.
      const inPagesDir = path.resolve(pagesDir, specPath)
      const inRoot = path.resolve(projectRoot, specPath)
      const resolvedPath = fs.existsSync(inPagesDir) ? inPagesDir
        : fs.existsSync(inRoot) ? inRoot
        : null
      if (!resolvedPath) {
        const locations = pagesDir !== projectRoot
          ? `\n  - ${inPagesDir}\n  - ${inRoot}`
          : `\n  - ${inRoot}`
        throw new Error(`[holocron] OpenAPI spec not found:${locations}`)
      }

      const processed = await processOpenAPISpec(resolvedPath)
      const specMap = new Map<string, OpWithDoc>()
      for (const op of extractOperations(processed)) {
        const item = { op, doc: processed }
        allOps.push(item)
        specMap.set(endpointKey(op.method, op.path), item)
      }
      opsBySpecFile.set(specPath, specMap)
    }

    // Spec has no operations. In selective mode the tab may still carry
    // hand-written MDX groups, so preserve them; in dedicated mode there is
    // nothing to generate.
    if (allOps.length === 0) return { groups: tab.groups, mdxContent }

    const { operationSlug, operationTitle, tagDisplayName } = await import('./process.ts')
    const { generateCurl } = await import('./curl-generator.ts')

    /** Compute the virtual slug for an operation (shared by both modes). */
    const slugFor = (op: ExtractedOperation): string =>
      slugPrefix ? `${slugPrefix}/${operationSlug(op)}` : operationSlug(op)

    // Track which operation owns each emitted slug, so referencing the SAME
    // endpoint twice dedups, but two DISTINCT operations colliding on one slug
    // (e.g. same METHOD+path across two specs under one openapiBase) errors.
    const emittedBySlug = new Map<string, OpWithDoc>()

    /** Build + register the virtual MDX for one operation; returns its slug. */
    const emitEndpoint = (item: OpWithDoc): string => {
      const { op, doc } = item
      const slug = slugFor(op)
      const existing = emittedBySlug.get(slug)
      if (existing) {
        if (existing === item) return slug // same endpoint referenced again
        throw new Error(
          `[holocron] two different OpenAPI operations map to the same page slug "${slug}" ` +
          `in tab "${tab.tab}" (${existing.op.method.toUpperCase()} ${existing.op.path} and ` +
          `${op.method.toUpperCase()} ${op.path}). Use distinct openapiBase prefixes or rename a path.`,
        )
      }
      emittedBySlug.set(slug, item)

      // Warn if the slug shadows a real MDX page on disk
      for (const ext of ['.mdx', '.md']) {
        if (fs.existsSync(path.join(pagesDir, slug + ext)) || fs.existsSync(path.join(projectRoot, slug + ext))) {
          logger.warn(formatHolocronWarning(
            `OpenAPI page "${slug}" shadows an MDX file on disk. ` +
            `The virtual OpenAPI page will be used instead.`,
          ))
          break
        }
      }

      mdxContent[slug] = buildEndpointMdx({
        op,
        doc,
        title: operationTitle(op),
        curl: generateCurl(op),
      })
      return slug
    }

    /** Look up an operation by an endpoint ref string, honoring an optional
     *  spec-file selector. Throws a helpful error if it cannot be resolved. */
    const resolveEndpointRef = (entry: string): OpWithDoc | undefined => {
      const ref = parseEndpointRef(entry)
      if (!ref) return undefined

      const key = endpointKey(ref.method, ref.path)
      let item: OpWithDoc | undefined
      if (ref.specFile) {
        const specMap = opsBySpecFile.get(ref.specFile)
        if (!specMap) {
          throw new Error(
            `[holocron] OpenAPI page "${entry}" in tab "${tab.tab}" references spec ` +
            `"${ref.specFile}", which is not listed in the tab's openapi field.`,
          )
        }
        item = specMap.get(key)
      } else {
        // No spec selector: search every spec. If more than one spec defines
        // the same METHOD /path the reference is ambiguous — error and tell the
        // author to disambiguate with the `specfile METHOD /path` form.
        const matches: { specFile: string; item: OpWithDoc }[] = []
        for (const [specFile, specMap] of opsBySpecFile) {
          const found = specMap.get(key)
          if (found) matches.push({ specFile, item: found })
        }
        if (matches.length > 1) {
          throw new Error(
            `[holocron] OpenAPI page "${entry}" in tab "${tab.tab}" is ambiguous: ` +
            `${ref.method.toUpperCase()} ${ref.path} exists in multiple specs ` +
            `(${matches.map((m) => `"${m.specFile}"`).join(', ')}). ` +
            `Disambiguate with the "specfile ${ref.method.toUpperCase()} ${ref.path}" form.`,
          )
        }
        item = matches[0]?.item
      }

      if (!item) {
        throw new Error(
          `[holocron] OpenAPI page "${entry}" in tab "${tab.tab}" does not match any ` +
          `${ref.method.toUpperCase()} ${ref.path} operation in the spec.`,
        )
      }
      return item
    }

    /** Build tag-grouped nav groups for a set of operations (shared by
     *  dedicated mode and the "..." rest-expansion in selective mode). */
    const buildTagGroups = (items: OpWithDoc[]): ConfigNavGroup[] => {
      const tagGroups = new Map<string, OpWithDoc[]>()
      for (const item of items) {
        const tag = item.op.tags[0] ?? 'default'
        const list = tagGroups.get(tag) ?? []
        list.push(item)
        tagGroups.set(tag, list)
      }
      const out: ConfigNavGroup[] = []
      for (const [tag, ops] of tagGroups) {
        out.push({
          group: tagDisplayName(tag, ops[0]!.doc),
          pages: ops.map((item) => emitEndpoint(item)),
        })
      }
      return out
    }

    // ── Selective mode: user authored groups/pages with endpoint refs ─────
    if (tab.groups.length > 0) {
      // Track which operations the author referenced explicitly, so the "..."
      // sentinel can expand only the *remaining* (unlisted) endpoints.
      const referenced = new Set<OpWithDoc>()
      let sawRest = false

      // Maps one authored entry to zero-or-more resolved entries. Returns an
      // array because the "..." sentinel expands into multiple tag groups.
      const mapPageEntry = (entry: ConfigNavPageEntry): ConfigNavPageEntry[] => {
        if (typeof entry !== 'string') {
          return [{ ...entry, pages: entry.pages.flatMap(mapPageEntry) }]
        }
        if (entry === '...') {
          if (sawRest) {
            throw new Error(
              `[holocron] tab "${tab.tab}" has more than one "..." entry. ` +
              `Only one rest-expansion is allowed per OpenAPI tab.`,
            )
          }
          sawRest = true
          // Resolve lazily below once every other entry has been visited.
          return [REST_PLACEHOLDER]
        }
        const item = resolveEndpointRef(entry)
        if (!item) return [entry] // normal MDX slug, untouched
        referenced.add(item)
        return [emitEndpoint(item)]
      }

      // First pass: resolve everything except "...", recording referenced ops.
      const groups: ConfigNavGroup[] = tab.groups.map((g) => ({
        ...g,
        pages: g.pages.flatMap(mapPageEntry),
      }))

      // Second pass: replace the "..." placeholder (if any) with tag groups
      // for all operations the author did not list explicitly.
      if (sawRest) {
        const rest = allOps.filter((item) => !referenced.has(item))
        const restGroups = buildTagGroups(rest)

        // The expanded tag groups must become TOP-LEVEL tab groups so they
        // render as always-visible sidebar sections (like dedicated mode),
        // not collapsed sub-groups nested inside a wrapper group. We therefore
        // hoist at the tab.groups level: a top-level group containing the
        // placeholder is split into [leading entries] + restGroups + [trailing
        // entries], where the leading/trailing slices keep the author's group
        // (so an explicitly named group is preserved). A placeholder nested
        // deeper than the top level stays in place (the author asked for it
        // inside that sub-group).
        const containsPlaceholderShallow = (pages: ConfigNavPageEntry[]): boolean =>
          pages.some((p) => p === REST_PLACEHOLDER)

        // Splice a placeholder that is nested below the top level (rare): keep
        // it as inline group entries within its parent's pages.
        const spliceNested = (pages: ConfigNavPageEntry[]): ConfigNavPageEntry[] =>
          pages.flatMap((p): ConfigNavPageEntry[] => {
            if (p === REST_PLACEHOLDER) return restGroups
            if (typeof p !== 'string') return [{ ...p, pages: spliceNested(p.pages) }]
            return [p]
          })

        const hoisted: ConfigNavGroup[] = []
        for (const g of groups) {
          if (!containsPlaceholderShallow(g.pages)) {
            // No top-level placeholder here, but it might be nested deeper.
            hoisted.push({ ...g, pages: spliceNested(g.pages) })
            continue
          }
          // Split this group's pages at the placeholder, hoisting restGroups to
          // top level between the leading and trailing slices.
          const idx = g.pages.findIndex((p) => p === REST_PLACEHOLDER)
          const before = g.pages.slice(0, idx).map(spliceNestedEntry)
          const after = g.pages.slice(idx + 1).map(spliceNestedEntry)
          if (before.length > 0) hoisted.push({ ...g, pages: before })
          hoisted.push(...restGroups)
          if (after.length > 0) hoisted.push({ ...g, pages: after })
        }

        function spliceNestedEntry(p: ConfigNavPageEntry): ConfigNavPageEntry {
          if (typeof p !== 'string') return { ...p, pages: spliceNested(p.pages) }
          return p
        }

        return { groups: hoisted, mdxContent }
      }

      return { groups, mdxContent }
    }

    // ── Dedicated mode: auto-group every endpoint by its first tag ────────
    const groups = buildTagGroups(allOps)

    return { groups, mdxContent }
  },
}

/** Build the virtual MDX string for a single OpenAPI operation. */
function buildEndpointMdx({
  op,
  doc,
  title,
  curl,
}: {
  op: ExtractedOperation
  doc: DereferencedDocument
  title: string
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

  return [
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
    '```bash lines=false',
    curl,
    '```',
    '',
    '</RequestExample>',
    '',
    ...(responseExampleJson ? [
      '<ResponseExample>',
      '',
      '```json lines=false',
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
