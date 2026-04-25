/**
 * OpenAPI endpoint renderer — client component.
 *
 * Renders a single API endpoint page. Follows fumadocs' Property pattern:
 * root-level fields use border-t dividers (no container boxes), nested
 * fields inside expandables get card-like bg-card borders.
 *
 * cURL + response examples are rendered via <Aside full> in the virtual
 * MDX (sync.ts), not here.
 */

'use client'

import React from 'react'
import { Expandable } from '../../components/markdown/mintlify/compat.tsx'
import { MethodBadge, NavBadge } from '../../components/markdown/nav-badge.tsx'

/* ── Types ────────────────────────────────────────────────────────────── */

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

/* ── Property — fumadocs style ────────────────────────────────────────── */

/**
 * Single schema property row. Follows fumadocs' Property pattern:
 * - Root level: `border-t py-4 first:border-t-0` (divider, no box)
 * - Nested (inside expandables): `p-3 border-x bg-card` (card-like)
 * - Name in mono+primary with * (required) or ? (optional)
 * - Type in mono muted
 * - Description below
 */
function Property({
  name,
  schema,
  required = false,
  nested = false,
  depth = 0,
}: {
  name: string
  schema: SchemaInfo
  required?: boolean
  nested?: boolean
  depth?: number
}) {
  const typeStr = schemaTypeString(schema)
  const hasNestedProps = schema.type === 'object' && schema.properties && Object.keys(schema.properties).length > 0
  const hasArrayItems = schema.type === 'array' && schema.items?.type === 'object' && schema.items?.properties
  const canExpand = (hasNestedProps || hasArrayItems) && depth <= 3

  const infoTags: { label: string; value: string }[] = []
  if (schema.default !== undefined) infoTags.push({ label: 'Default', value: JSON.stringify(schema.default) })
  if (schema.pattern) infoTags.push({ label: 'Pattern', value: schema.pattern })
  if (schema.minimum !== undefined) infoTags.push({ label: 'Min', value: String(schema.minimum) })
  if (schema.maximum !== undefined) infoTags.push({ label: 'Max', value: String(schema.maximum) })
  if (schema.minLength !== undefined) infoTags.push({ label: 'Min length', value: String(schema.minLength) })
  if (schema.maxLength !== undefined) infoTags.push({ label: 'Max length', value: String(schema.maxLength) })

  return (
    <div className={nested
      ? 'text-sm p-3 border-x border-border bg-card last:rounded-b-xl first:rounded-tr-xl last:border-b'
      : 'text-sm border-t border-border py-4 first:border-t-0'
    }>
      <div className='flex flex-wrap items-center gap-2'>
        <span className='font-medium font-mono text-primary'>
          {name}
          {required
            ? <span className='text-red'>*</span>
            : <span className='text-muted-foreground'>?</span>
          }
        </span>
        <span className='font-mono text-muted-foreground'>{typeStr}</span>
        {schema.deprecated && <NavBadge label='deprecated' color='yellow' />}
      </div>
      <div className='pt-1.5 empty:hidden'>
        {schema.description && (
          <div className='text-muted-foreground'>{schema.description}</div>
        )}
        {infoTags.length > 0 && (
          <div className='flex flex-wrap gap-1.5 mt-1.5'>
            {infoTags.map((tag) => (
              <span key={tag.label} className='inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground'>
                <span className='font-medium'>{tag.label}:</span> <code>{tag.value}</code>
              </span>
            ))}
          </div>
        )}
        {canExpand && (
          <div className='mt-2'>
            <Expandable title={`Show ${hasArrayItems ? 'item ' : ''}properties`}>
              {Object.entries((hasArrayItems ? schema.items! : schema).properties!).map(([key, propSchema]) => (
                <Property
                  key={key}
                  name={key}
                  schema={propSchema as SchemaInfo}
                  required={((hasArrayItems ? schema.items! : schema).required ?? []).includes(key)}
                  nested
                  depth={depth + 1}
                />
              ))}
            </Expandable>
          </div>
        )}
      </div>
    </div>
  )
}

/* ── Parameter group ──────────────────────────────────────────────────── */

function ParameterGroup({ title, params }: { title: string; params: ParameterInfo[] }) {
  if (params.length === 0) return null
  return (
    <div>
      <div className='text-sm font-semibold text-foreground mb-1'>{title}</div>
      <div className='flex flex-col'>
        {params.map((p) => (
          <Property
            key={p.name}
            name={p.name}
            schema={{ ...(p.schema ?? {}), description: p.description ?? p.schema?.description }}
            required={p.required}
          />
        ))}
      </div>
    </div>
  )
}

/* ── Response section ─────────────────────────────────────────────────── */

function ResponseSection({ responses }: { responses: ResponseInfo[] }) {
  if (responses.length === 0) return null
  return (
    <div>
      <div className='text-sm font-semibold text-foreground mb-1'>Response</div>
      <div className='flex flex-col gap-2'>
        {responses.map((r) => {
          const hasSchema = r.schema && (
            (r.schema.properties && Object.keys(r.schema.properties).length > 0) ||
            r.schema.type === 'array' || r.schema.type
          )

          if (!hasSchema && !r.description) {
            return (
              <div key={r.status} className='border-t border-border py-4 first:border-t-0'>
                <span className='font-mono text-muted-foreground'>{r.status}</span>
              </div>
            )
          }

          return (
            <Expandable key={r.status} title={`${r.status}${r.description ? ` · ${r.description}` : ''}`}>
              {hasSchema && r.schema && <ResponseSchema schema={r.schema} />}
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

/** Render response schema fields (no outer container). */
function ResponseSchema({ schema }: { schema: SchemaInfo }) {
  if (schema.properties && Object.keys(schema.properties).length > 0) {
    return (
      <div className='flex flex-col'>
        {Object.entries(schema.properties).map(([key, propSchema]) => (
          <Property
            key={key}
            name={key}
            schema={propSchema as SchemaInfo}
            required={(schema.required ?? []).includes(key)}
          />
        ))}
      </div>
    )
  }
  if (schema.type === 'array' && schema.items) {
    return <Property name='items' schema={schema.items} />
  }
  if (schema.type) {
    return (
      <div className='text-sm text-muted-foreground'>
        Type: <code>{schemaTypeString(schema)}</code>
      </div>
    )
  }
  return null
}

/* ── Auth section ─────────────────────────────────────────────────────── */

function AuthSection({ security }: { security: SecurityInfo[] }) {
  if (security.length === 0) return null
  return (
    <div>
      <div className='text-sm font-semibold text-foreground mb-1'>Authorization</div>
      <div className='flex flex-col'>
        {security.map((s) => (
          <div key={s.name} className='text-sm border-t border-border py-4 first:border-t-0'>
            <div className='flex flex-wrap items-center gap-2'>
              <span className='font-medium font-mono text-primary'>{s.name}</span>
              <span className='font-mono text-muted-foreground'>
                {s.type === 'http' && s.scheme === 'bearer' ? 'Bearer <token>' : s.type === 'apiKey' ? '<token>' : s.type}
              </span>
            </div>
            <div className='pt-1.5 empty:hidden'>
              {s.description && <div className='text-muted-foreground'>{s.description}</div>}
              {s.in && (
                <div className='text-muted-foreground'>
                  Token in: <code>{s.in}</code>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── Request body section ─────────────────────────────────────────────── */

function RequestBodySection({ body }: { body: NonNullable<OpenAPIEndpointProps['requestBody']> }) {
  return (
    <div>
      <div className='flex items-center gap-2 mb-1'>
        <span className='text-sm font-semibold text-foreground'>Request Body</span>
        <code className='text-xs text-muted-foreground'>{body.contentType}</code>
        {body.required && <NavBadge label='required' color='green' />}
      </div>
      {body.description && (
        <div className='text-sm text-muted-foreground mb-2'>{body.description}</div>
      )}
      {body.schema && <ResponseSchema schema={body.schema} />}
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
      {/* Header: method badge + path */}
      <div className='flex items-center gap-2.5'>
        <MethodBadge method={props.method} />
        <code className='text-sm text-muted-foreground font-mono'>{props.path}</code>
        {props.deprecated && <NavBadge label='deprecated' color='orange' />}
      </div>

      {props.description && (
        <div className='text-sm text-muted-foreground'>{props.description}</div>
      )}

      <AuthSection security={props.security} />
      <ParameterGroup title='Path Parameters' params={pathParams} />
      <ParameterGroup title='Query Parameters' params={queryParams} />
      <ParameterGroup title='Header Parameters' params={headerParams} />
      <ParameterGroup title='Cookie Parameters' params={cookieParams} />
      {props.requestBody && <RequestBodySection body={props.requestBody} />}
      <ResponseSection responses={props.responses} />
    </div>
  )
}
