/**
 * cURL request example generator for OpenAPI operations.
 *
 * Takes an extracted operation + server base URL and produces a formatted
 * cURL command string with headers, auth, query params, and request body.
 */

import type { OpenAPIV3 } from 'openapi-types'
import type { ExtractedOperation } from './process.ts'
import { sample } from './sample.ts'

function quote(s: string): string {
  return `"${s.replace(/"/g, '\\"')}"`
}

function singleQuote(s: string): string {
  return `'${s.replace(/'/g, "'\\''")}'`
}

/** Generate a sample value for a parameter based on its schema. */
function sampleParam(param: OpenAPIV3.ParameterObject): string {
  if (param.example !== undefined) return String(param.example)
  if (param.schema && typeof param.schema === 'object') {
    const s = param.schema as OpenAPIV3.SchemaObject
    if (s.example !== undefined) return String(s.example)
    if (s.default !== undefined) return String(s.default)
    if (s.enum && s.enum.length > 0) return String(s.enum[0])
    if (s.type === 'integer' || s.type === 'number') return '0'
    if (s.type === 'boolean') return 'true'
  }
  return `<${param.name}>`
}

export function generateCurl(op: ExtractedOperation, baseUrl?: string): string {
  const base = baseUrl ?? op.servers[0]?.url ?? 'https://api.example.com'

  // Build URL with path params substituted
  let urlPath = op.path
  const pathParams = op.parameters.filter((p) => p.in === 'path')
  for (const p of pathParams) {
    urlPath = urlPath.replace(`{${p.name}}`, sampleParam(p))
  }

  // Query params
  const queryParams = op.parameters.filter((p) => p.in === 'query')
  const queryParts: string[] = []
  for (const p of queryParams) {
    if (p.required) {
      queryParts.push(`${encodeURIComponent(p.name)}=${encodeURIComponent(sampleParam(p))}`)
    }
  }
  const queryString = queryParts.length > 0 ? `?${queryParts.join('&')}` : ''
  const fullUrl = `${base.replace(/\/$/, '')}${urlPath}${queryString}`

  const parts: string[] = []
  parts.push(`curl -X ${op.method.toUpperCase()} ${quote(fullUrl)}`)

  // Header params
  const headerParams = op.parameters.filter((p) => p.in === 'header')
  for (const p of headerParams) {
    parts.push(`  -H ${quote(`${p.name}: ${sampleParam(p)}`)}`)
  }

  // Auth headers from security
  if (op.security.length > 0) {
    // Just add a placeholder Authorization header for bearer/apiKey
    parts.push(`  -H ${quote('Authorization: Bearer <token>')}`)
  }

  // Request body
  const requestBody = op.operation.requestBody as OpenAPIV3.RequestBodyObject | undefined
  if (requestBody?.content) {
    const jsonContent = requestBody.content['application/json']
    if (jsonContent) {
      parts.push(`  -H ${quote('Content-Type: application/json')}`)
      const schema = jsonContent.schema as OpenAPIV3.SchemaObject | undefined
      if (jsonContent.example) {
        parts.push(`  -d ${singleQuote(JSON.stringify(jsonContent.example, null, 2))}`)
      } else if (schema) {
        const sampleBody = sample(schema as Record<string, unknown>)
        if (sampleBody !== null && sampleBody !== undefined) {
          parts.push(`  -d ${singleQuote(JSON.stringify(sampleBody, null, 2))}`)
        }
      }
    } else {
      // Use first available content type
      const [contentType, mediaObj] = Object.entries(requestBody.content)[0] ?? []
      if (contentType && mediaObj) {
        parts.push(`  -H ${quote(`Content-Type: ${contentType}`)}`)
      }
    }
  }

  return parts.join(' \\\n')
}
