/**
 * OpenAPI endpoint renderer — server component.
 *
 * Renders as RSC so that safe-mdx markdown parsing (remark-frontmatter, etc.)
 * stays server-side and never enters the client bundle. Interactive children
 * like Expandable are already 'use client' boundaries.
 *
 * Two gap levels: gap-(--prose-gap) between sections, gap-3 within.
 * text-sm set once at root, not repeated on every element.
 */

import React from 'react'
import { Expandable } from '../../components/markdown/expandable.tsx'
import { MethodBadge, NavBadge } from '../../components/layout/nav-badge.tsx'
import {
  Desc,
  FieldList,
  Property,
  Section,
  type SchemaInfo,
} from '../render-schema.tsx'

// Re-export for consumers that imported from this file before the extraction
export { Desc, type SchemaInfo }

/* ── OpenAPI-specific types ───────────────────────────────────────────── */

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

/* ── OpenAPI-specific sections ────────────────────────────────────────── */

function AuthSection({ security }: { security: SecurityInfo[] }) {
  if (security.length === 0) return null
  return (
    <Section title='Authorization'>
      {security.map((s) => {
        const schema: SchemaInfo = {
            type: s.type === 'http' && s.scheme === 'bearer' ? 'Bearer <token>' : s.type === 'apiKey' ? '<token>' : s.type,
            description: [s.description, s.in ? `Token in: ${s.in}` : ''].filter(Boolean).join('. ') || undefined,
        }
        return (
          <Property
            key={s.name}
            name={s.name}
            schema={schema}
            required
          />
        )
      })}
    </Section>
  )
}

function ParameterGroup({ title, params }: { title: string; params: ParameterInfo[] }) {
  if (params.length === 0) return null
  return (
    <Section title={title}>
      {params.map((p) => (
        <Property key={p.name} name={p.name} schema={{ ...(p.schema ?? {}), description: p.description ?? p.schema?.description }} required={p.required} />
      ))}
    </Section>
  )
}

function RequestBodySection({ body }: { body: NonNullable<OpenAPIEndpointProps['requestBody']> }) {
  return (
    <Section title={
      <div className='flex items-center gap-2'>
        <span>Request Body</span>
        <code className='text-xs font-normal text-muted-foreground'>{body.contentType}</code>
        {body.required && <NavBadge label='required' color='green' />}
      </div>
    }>
      {body.description && <Desc>{body.description}</Desc>}
      {body.schema && <FieldList schema={body.schema} />}
    </Section>
  )
}

function ResponseSection({ responses }: { responses: ResponseInfo[] }) {
  if (responses.length === 0) return null
  return (
    <div className='flex flex-col gap-4'>
      <div className='font-semibold text-foreground'>Response</div>
      <div className='flex flex-col gap-4'>
        {responses.map((r) => {
          const hasSchema = r.schema && (
            (r.schema.properties && Object.keys(r.schema.properties).length > 0) ||
            r.schema.type === 'array' || r.schema.type
          )
          // OpenAPI "default" response with no schema/description is noise — skip it
          if (!hasSchema && !r.description) {
            if (r.status === 'default') return null
            return <div key={r.status} className='font-mono code-font-size text-muted-foreground'>{r.status}</div>
          }
          const statusLabel = r.status === 'default' ? 'Default' : r.status
          return (
            <Expandable key={r.status} title={`${statusLabel}${r.description ? ` · ${r.description}` : ''}`} defaultOpen={r.status === '200'}>
              {hasSchema && r.schema && <FieldList schema={r.schema} />}
              {!hasSchema && r.description && <Desc>{r.description}</Desc>}
            </Expandable>
          )
        })}
      </div>
    </div>
  )
}

/* ── Main ─────────────────────────────────────────────────────────────── */

export function OpenAPIEndpoint(props: OpenAPIEndpointProps) {
  const path = props.parameters.filter((p) => p.in === 'path')
  const query = props.parameters.filter((p) => p.in === 'query')
  const header = props.parameters.filter((p) => p.in === 'header')
  const cookie = props.parameters.filter((p) => p.in === 'cookie')

  return (
    <div className='flex flex-col gap-(--prose-gap) text-sm'>
      <div className='flex flex-col gap-2'>
        <div className='flex items-center gap-3'>
          <code className='code-font-size text-muted-foreground font-mono'>{props.path}</code>
          <MethodBadge method={props.method} />
          {props.deprecated && <NavBadge label='deprecated' color='orange' />}
        </div>
        {props.description && <Desc>{props.description}</Desc>}
      </div>
      <AuthSection security={props.security} />
      <ParameterGroup title='Path Parameters' params={path} />
      <ParameterGroup title='Query Parameters' params={query} />
      <ParameterGroup title='Header Parameters' params={header} />
      <ParameterGroup title='Cookie Parameters' params={cookie} />
      {props.requestBody && <RequestBodySection body={props.requestBody} />}
      <ResponseSection responses={props.responses} />
    </div>
  )
}
