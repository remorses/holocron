/**
 * OpenAPI endpoint renderer — server component.
 *
 * Renders a single API endpoint page using existing editorial components:
 * Badge, Expandable, CodeBlock, RequestExample, ResponseExample.
 *
 * The component receives a serialized operation (extracted at build time
 * by sync.ts) and renders the full endpoint documentation including
 * method badge, parameters, request body, responses, and cURL example.
 */

'use client'

import React from 'react'
import { Badge, Expandable } from '../../components/markdown/mintlify/compat.tsx'
import { MethodBadge } from '../../components/markdown/nav-badge.tsx'

/* ── Types ────────────────────────────────────────────────────────────── */

/** Serialized schema for rendering. Fully dereferenced, no $refs. */
export interface SchemaInfo {
  type?: string
  format?: string
  description?: string
  required?: string[]
  properties?: Record<string, SchemaInfo>
  items?: SchemaInfo
  enum?: unknown[]
  default?: unknown
  example?: unknown
  oneOf?: SchemaInfo[]
  anyOf?: SchemaInfo[]
  allOf?: SchemaInfo[]
  additionalProperties?: boolean | SchemaInfo
  nullable?: boolean
  deprecated?: boolean
  minimum?: number
  maximum?: number
  minLength?: number
  maxLength?: number
  pattern?: string
  title?: string
}

export interface ParameterInfo {
  name: string
  in: 'path' | 'query' | 'header' | 'cookie'
  required?: boolean
  deprecated?: boolean
  description?: string
  schema?: SchemaInfo
}

export interface ResponseInfo {
  status: string
  description?: string
  schema?: SchemaInfo
  /** Explicit example from the spec (only shown if present). */
  example?: unknown
}

export interface SecurityInfo {
  name: string
  type: string
  scheme?: string
  in?: string
  description?: string
}

export interface OpenAPIEndpointProps {
  method: string
  path: string
  summary?: string
  description?: string
  parameters: ParameterInfo[]
  requestBody?: {
    required?: boolean
    description?: string
    contentType: string
    schema?: SchemaInfo
  }
  responses: ResponseInfo[]
  security: SecurityInfo[]
  servers: { url: string; description?: string }[]
  deprecated?: boolean
}

/* ── Schema type string ───────────────────────────────────────────────── */

function schemaTypeString(schema: SchemaInfo | undefined): string {
  if (!schema) return 'unknown'
  if (schema.enum) return schema.enum.map((v) => JSON.stringify(v)).join(' | ')
  if (schema.oneOf) return schema.oneOf.map(schemaTypeString).join(' | ')
  if (schema.anyOf) return schema.anyOf.map(schemaTypeString).join(' | ')
  if (schema.type === 'array' && schema.items) return `${schemaTypeString(schema.items)}[]`
  let base = schema.type ?? 'object'
  if (schema.format) base += ` (${schema.format})`
  if (schema.nullable) base += ' | null'
  return base
}

/* ── Schema property renderer (recursive) ─────────────────────────────── */

function SchemaProperty({
  name,
  schema,
  required = false,
  depth = 0,
}: {
  name: string
  schema: SchemaInfo
  required?: boolean
  depth?: number
}) {
  const typeStr = schemaTypeString(schema)
  const hasNestedProps = schema.type === 'object' && schema.properties && Object.keys(schema.properties).length > 0
  const hasArrayItems = schema.type === 'array' && schema.items?.type === 'object' && schema.items?.properties
  const isExpandable = hasNestedProps || hasArrayItems

  const infoTags: { label: string; value: string }[] = []
  if (schema.default !== undefined) infoTags.push({ label: 'Default', value: JSON.stringify(schema.default) })
  if (schema.pattern) infoTags.push({ label: 'Pattern', value: schema.pattern })
  if (schema.minimum !== undefined) infoTags.push({ label: 'Min', value: String(schema.minimum) })
  if (schema.maximum !== undefined) infoTags.push({ label: 'Max', value: String(schema.maximum) })
  if (schema.minLength !== undefined) infoTags.push({ label: 'Min length', value: String(schema.minLength) })
  if (schema.maxLength !== undefined) infoTags.push({ label: 'Max length', value: String(schema.maxLength) })

  const content = (
    <div className='flex flex-col gap-1.5'>
      <div className='flex flex-wrap items-center gap-2'>
        <code className='text-sm font-semibold text-foreground'>{name}</code>
        {required && <span className='text-red text-sm'>*</span>}
        <span className='text-xs font-mono text-muted-foreground'>{typeStr}</span>
        {schema.deprecated && <Badge color='orange' size='xs'>deprecated</Badge>}
      </div>
      {schema.description && (
        <div className='text-sm text-muted-foreground'>{schema.description}</div>
      )}
      {infoTags.length > 0 && (
        <div className='flex flex-wrap gap-1.5'>
          {infoTags.map((tag) => (
            <span key={tag.label} className='inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground'>
              <span className='font-medium'>{tag.label}:</span> <code>{tag.value}</code>
            </span>
          ))}
        </div>
      )}
    </div>
  )

  if (!isExpandable || depth > 3) {
    return <div className='py-3'>{content}</div>
  }

  const nestedSchema = hasArrayItems ? schema.items! : schema
  const nestedProps = nestedSchema.properties ?? {}
  const nestedRequired = new Set(nestedSchema.required ?? [])

  return (
    <div className='flex flex-col gap-3 py-3'>
      {content}
      <Expandable title={`Show ${hasArrayItems ? 'item ' : ''}properties`} defaultOpen={depth === 0}>
        {Object.entries(nestedProps).map(([key, propSchema]) => (
          <SchemaProperty
            key={key}
            name={key}
            schema={propSchema as SchemaInfo}
            required={nestedRequired.has(key)}
            depth={depth + 1}
          />
        ))}
      </Expandable>
    </div>
  )
}

/* ── Parameter group ──────────────────────────────────────────────────── */

function ParameterGroup({ title, params }: { title: string; params: ParameterInfo[] }) {
  if (params.length === 0) return null
  return (
    <div className='flex flex-col gap-0'>
      <div className='text-sm font-semibold text-foreground mb-2'>{title}</div>
      <div className='rounded-lg border border-border-subtle bg-card'>
        <div className='flex flex-col divide-y divide-border-subtle px-4'>
          {params.map((p) => (
            <SchemaProperty
              key={p.name}
              name={p.name}
              schema={{ ...(p.schema ?? {}), description: p.description ?? p.schema?.description }}
              required={p.required}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

/* ── Response accordion ───────────────────────────────────────────────── */

function ResponseSection({ responses }: { responses: ResponseInfo[] }) {
  if (responses.length === 0) return null
  return (
    <div className='flex flex-col gap-0'>
      <div className='text-sm font-semibold text-foreground mb-2'>Responses</div>
      <div className='flex flex-col gap-2'>
        {responses.map((r) => {
          const hasSchema = r.schema && (
            (r.schema.properties && Object.keys(r.schema.properties).length > 0) ||
            r.schema.type === 'array' ||
            r.schema.type
          )
          const statusColor = r.status.startsWith('2') ? 'green'
            : r.status.startsWith('4') ? 'orange'
            : r.status.startsWith('5') ? 'red'
            : 'gray'

          if (!hasSchema && !r.description) {
            return (
              <div key={r.status} className='flex items-center gap-2 rounded-lg border border-border-subtle bg-card px-4 py-3'>
                <Badge color={statusColor} size='sm'>{r.status}</Badge>
                <span className='text-sm text-muted-foreground'>No content</span>
              </div>
            )
          }

          return (
            <Expandable key={r.status} title={`${r.status} ${r.description ?? ''}`}>
              {hasSchema && r.schema && <SchemaFields schema={r.schema} />}
              {!hasSchema && r.description && (
                <div className='text-sm text-muted-foreground'>{r.description}</div>
              )}
            </Expandable>
          )
        })}
      </div>
    </div>
  )
}

/* ── Auth section ─────────────────────────────────────────────────────── */

function AuthSection({ security }: { security: SecurityInfo[] }) {
  if (security.length === 0) return null
  return (
    <div className='flex flex-col gap-0'>
      <div className='text-sm font-semibold text-foreground mb-2'>Authorization</div>
      <div className='rounded-lg border border-border-subtle bg-card px-4 divide-y divide-border-subtle'>
        {security.map((s) => (
          <div key={s.name} className='flex flex-col gap-1.5 py-3'>
            <div className='flex flex-wrap items-center gap-2'>
              <code className='text-sm font-semibold text-foreground'>{s.name}</code>
              <span className='text-xs font-mono text-muted-foreground'>
                {s.type === 'http' && s.scheme === 'bearer' ? 'Bearer <token>' : s.type === 'apiKey' ? '<token>' : s.type}
              </span>
            </div>
            {s.description && <div className='text-sm text-muted-foreground'>{s.description}</div>}
            {s.in && (
              <div className='text-xs text-muted-foreground'>
                Token in: <code className='text-xs'>{s.in === 'header' ? 'header' : s.in}</code>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── Request body section ─────────────────────────────────────────────── */

/** Render schema fields for any root shape: objects show properties,
 *  arrays show item schema, primitives show a single type line. */
function SchemaFields({ schema }: { schema: SchemaInfo }) {
  // Object with properties → render each property
  if (schema.properties && Object.keys(schema.properties).length > 0) {
    return (
      <div className='rounded-lg border border-border-subtle bg-card px-4'>
        <div className='flex flex-col divide-y divide-border-subtle'>
          {Object.entries(schema.properties).map(([key, propSchema]) => (
            <SchemaProperty
              key={key}
              name={key}
              schema={propSchema as SchemaInfo}
              required={(schema.required ?? []).includes(key)}
            />
          ))}
        </div>
      </div>
    )
  }
  // Array → show the item type
  if (schema.type === 'array' && schema.items) {
    return (
      <div className='rounded-lg border border-border-subtle bg-card px-4'>
        <SchemaProperty name='items' schema={schema.items} />
      </div>
    )
  }
  // Primitive or other → show type info
  if (schema.type) {
    return (
      <div className='text-sm text-muted-foreground'>
        Type: <code className='text-xs'>{schemaTypeString(schema)}</code>
        {schema.description && <span> — {schema.description}</span>}
      </div>
    )
  }
  return null
}

function RequestBodySection({ body }: { body: NonNullable<OpenAPIEndpointProps['requestBody']> }) {
  return (
    <div className='flex flex-col gap-0'>
      <div className='flex items-center gap-2 mb-2'>
        <span className='text-sm font-semibold text-foreground'>Request Body</span>
        <code className='text-xs text-muted-foreground'>{body.contentType}</code>
        {body.required && <Badge color='green' size='xs'>required</Badge>}
      </div>
      {body.description && (
        <div className='text-sm text-muted-foreground mb-2'>{body.description}</div>
      )}
      {body.schema && <SchemaFields schema={body.schema} />}
    </div>
  )
}

/* ── Main endpoint component ──────────────────────────────────────────── */

export function OpenAPIEndpoint(props: OpenAPIEndpointProps) {
  const pathParams = props.parameters.filter((p) => p.in === 'path')
  const queryParams = props.parameters.filter((p) => p.in === 'query')
  const headerParams = props.parameters.filter((p) => p.in === 'header')
  const cookieParams = props.parameters.filter((p) => p.in === 'cookie')

  return (
    <div className='flex flex-col gap-(--prose-gap)'>
      {/* Header */}
      <div className='flex flex-col gap-2'>
        <div className='flex items-center gap-2.5'>
          <MethodBadge method={props.method} />
          <code className='text-sm text-muted-foreground font-mono'>{props.path}</code>
          {props.deprecated && <Badge color='orange' size='xs'>deprecated</Badge>}
        </div>
        {props.description && (
          <div className='text-sm text-muted-foreground'>{props.description}</div>
        )}
      </div>

      {/* Auth */}
      <AuthSection security={props.security} />

      {/* Parameters by location */}
      <ParameterGroup title='Path Parameters' params={pathParams} />
      <ParameterGroup title='Query Parameters' params={queryParams} />
      <ParameterGroup title='Header Parameters' params={headerParams} />
      <ParameterGroup title='Cookie Parameters' params={cookieParams} />

      {/* Request body */}
      {props.requestBody && <RequestBodySection body={props.requestBody} />}

      {/* Responses */}
      <ResponseSection responses={props.responses} />

      {/* cURL + response examples are rendered via <Aside full> in the virtual
          MDX (sync.ts), not here. The editorial section splitter places them in
          the right sidebar with proper syntax highlighting via CodeBlock. */}
    </div>
  )
}
