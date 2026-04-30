/**
 * OpenAPI spec processing pipeline.
 *
 * Loads an OpenAPI spec (JSON or YAML), bundles external $refs via @scalar,
 * upgrades to 3.x, and dereferences all internal $refs. The result is a
 * fully-inlined document with no $ref pointers, ready for rendering.
 *
 * Architecture copied from fumadocs (MIT) `utils/document/process.ts`.
 */

import type { OpenAPIV3, OpenAPIV3_1 } from 'openapi-types'
import { bundle } from '@scalar/json-magic/bundle'
import { upgrade } from '@scalar/openapi-upgrader'
import { readFiles } from '@scalar/json-magic/bundle/plugins/node'

/* ── Types ────────────────────────────────────────────────────────────── */

/** Union of OpenAPI 3.0 and 3.1 documents. After upgrade+dereference
 *  the document is always 3.x but we keep both for type flexibility. */
export type OpenAPIDocument = OpenAPIV3.Document | OpenAPIV3_1.Document

/** Fully dereferenced document — no $ref pointers anywhere. */
export interface DereferencedDocument {
  dereferenced: OpenAPIDocument
  /** Look up the original $ref string for a dereferenced object. */
  getRawRef: (obj: object) => string | undefined
  bundled: OpenAPIDocument
}

export type HttpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete' | 'head' | 'options' | 'trace'

export const HTTP_METHODS: HttpMethod[] = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'trace']

/** A single API operation extracted from the spec. */
export interface ExtractedOperation {
  path: string
  method: HttpMethod
  operation: OpenAPIV3.OperationObject | OpenAPIV3_1.OperationObject
  /** Merged parameters from path item + operation level. */
  parameters: (OpenAPIV3.ParameterObject | OpenAPIV3_1.ParameterObject)[]
  /** Security requirements (operation-level or fallback to global). */
  security: (OpenAPIV3.SecurityRequirementObject)[]
  /** Server URLs from operation, path, or global level. */
  servers: (OpenAPIV3.ServerObject)[]
  tags: string[]
}

/* ── $ref utilities ───────────────────────────────────────────────────── */

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === null || prototype === Object.prototype || Object.getPrototypeOf(prototype) === null
}

function decodeInternalRef(ref: string): string[] {
  if (!ref.startsWith('#')) throw new Error(`expected in-document $ref starting with '#', got: ${ref}`)
  const raw = ref.slice(1)
  const out: string[] = []
  if (raw.length === 0) return out
  for (const token of raw.split('/')) {
    if (token.length === 0) continue
    out.push(token.replace(/~1/g, '/').replace(/~0/g, '~'))
  }
  return out
}

function resolveRefSync(ref: string, schema: unknown): unknown | undefined {
  let current = schema
  for (const seg of decodeInternalRef(ref)) {
    if (isPlainObject(current)) current = current[seg]
    else return
  }
  return current
}

/** Recursively resolve all $ref pointers in-place on a structuredClone'd tree. */
function dereferenceSync(
  schema: unknown,
  setOriginalRef: (obj: object, ref: string) => void,
): unknown {
  if (typeof schema === 'boolean') return schema
  const visitedNodes = new Set<unknown>()
  const cloned = structuredClone(schema)

  function resolve(current: unknown): unknown {
    if (visitedNodes.has(current)) return current
    visitedNodes.add(current)

    if (Array.isArray(current)) {
      for (let i = 0; i < current.length; i++) {
        current[i] = resolve(current[i])
      }
    } else if (isPlainObject(current)) {
      if (typeof current.$ref === 'string') {
        const ref = current.$ref
        delete current.$ref
        const resolved = resolve(resolveRefSync(ref, cloned))
        if (resolved && typeof resolved === 'object') {
          setOriginalRef(resolved, ref)
          setOriginalRef(current as object, ref)
        }
        if (typeof resolved === 'boolean') throw new Error('invalid schema')
        if (resolved && typeof resolved === 'object') {
          for (const k in resolved as Record<string, unknown>) {
            if (!(k in current)) {
              current[k] = (resolved as Record<string, unknown>)[k]
            }
          }
        }
      }
      for (const key in current) {
        current[key] = resolve(current[key])
      }
    }
    return current
  }

  return resolve(cloned)
}

function dereferenceDocument(bundled: OpenAPIDocument): DereferencedDocument {
  const dereferenceMap = new Map<object, string>()
  return {
    bundled,
    dereferenced: dereferenceSync(bundled, (obj, ref) => {
      dereferenceMap.set(obj, ref)
    }) as OpenAPIDocument,
    getRawRef(obj: object) {
      return dereferenceMap.get(obj)
    },
  }
}

/* ── Process pipeline ─────────────────────────────────────────────────── */

/**
 * Process an OpenAPI spec: bundle $refs, upgrade to 3.x, dereference.
 *
 * @param input - File path (relative to cwd or absolute), URL, or parsed object.
 */
export async function processOpenAPISpec(input: string | object): Promise<DereferencedDocument> {
  const bundled: OpenAPIDocument = await bundle(input as string, {
    plugins: [readFiles()],
    treeShake: true,
    hooks: {
      onResolveError(node) {
        throw new Error(`Failed to resolve $ref: ${(node as Record<string, unknown>).$ref}`)
      },
    },
  })
    .then((v) => upgrade(v as never, '3.1') as OpenAPIDocument)
    .catch((e) => {
      throw new Error(`[OpenAPI] Failed to process spec: ${typeof input === 'string' ? input : '<object>'}`, { cause: e })
    })

  return dereferenceDocument(bundled)
}

/* ── Operation extraction ─────────────────────────────────────────────── */

/** Extract all operations from a dereferenced OpenAPI document. */
export function extractOperations(doc: DereferencedDocument): ExtractedOperation[] {
  const { dereferenced } = doc
  const globalSecurity = dereferenced.security ?? []
  const globalServers = dereferenced.servers ?? []
  const operations: ExtractedOperation[] = []

  const paths = dereferenced.paths ?? {}
  for (const [pathStr, pathItem] of Object.entries(paths)) {
    if (!pathItem || typeof pathItem !== 'object') continue
    const pi = pathItem as OpenAPIV3.PathItemObject
    const pathParams = (pi.parameters ?? []) as OpenAPIV3.ParameterObject[]
    const pathServers = pi.servers ?? []

    for (const method of HTTP_METHODS) {
      const op = pi[method]
      if (!op) continue

      const opParams = (op.parameters ?? []) as OpenAPIV3.ParameterObject[]
      // Merge: operation params override path params by name+in
      const paramMap = new Map<string, OpenAPIV3.ParameterObject>()
      for (const p of pathParams) paramMap.set(`${p.in}:${p.name}`, p)
      for (const p of opParams) paramMap.set(`${p.in}:${p.name}`, p)

      operations.push({
        path: pathStr,
        method,
        operation: op,
        parameters: Array.from(paramMap.values()),
        security: op.security ?? globalSecurity,
        servers: op.servers ?? (pathServers.length > 0 ? pathServers : globalServers),
        tags: op.tags ?? ['default'],
      })
    }
  }

  return operations
}

/** Group operations by their first tag. */
export function groupOperationsByTag(operations: ExtractedOperation[]): Map<string, ExtractedOperation[]> {
  const groups = new Map<string, ExtractedOperation[]>()
  for (const op of operations) {
    const tag = op.tags[0] ?? 'default'
    const list = groups.get(tag) ?? []
    list.push(op)
    groups.set(tag, list)
  }
  return groups
}

/** Generate a URL-safe slug for an operation. */
export function operationSlug(op: ExtractedOperation): string {
  const pathPart = op.path
    .replace(/^\//, '')
    .replace(/[{}]/g, '')
    .replace(/\//g, '-')
    .replace(/[^a-zA-Z0-9-]/g, '')
  return `${op.method}-${pathPart}`.toLowerCase()
}

/** Get a display title for an operation. */
export function operationTitle(op: ExtractedOperation): string {
  if (op.operation.summary) return op.operation.summary
  if (op.operation.operationId) {
    return op.operation.operationId
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/[_-]/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase())
  }
  return `${op.method.toUpperCase()} ${op.path}`
}

/** Pretty-print a tag name (converts kebab/snake to Title Case). */
export function tagDisplayName(
  tag: string,
  doc: DereferencedDocument,
): string {
  const tagObj = (doc.dereferenced.tags ?? []).find((t) => t.name === tag)
  if (tagObj?.description) return tagObj.name
  return tag
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}
