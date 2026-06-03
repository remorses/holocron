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
import { SafeMdxRenderer } from 'safe-mdx'
import { mdxParse } from 'safe-mdx/parse'
import { Expandable } from '../../components/markdown/expandable.tsx'
import { MethodBadge, NavBadge } from '../../components/layout/nav-badge.tsx'
import { P, A, Code } from '../../components/markdown/typography.tsx'
import { List, OL, Li, Blockquote } from '../../components/markdown/layout.tsx'
import { CodeBlock } from '../../components/markdown/code-block.tsx'

/* ── Markdown descriptions ────────────────────────────────────────────── */

/**
 * OpenAPI `description` fields are Markdown by spec (headings, lists, code,
 * links, emphasis). Render them through safe-mdx with a focused component map
 * instead of dumping raw text (issue #96). safe-mdx is isomorphic, so this
 * works inside this client component. The map is intentionally small to keep
 * the client bundle light — no nested MDX components, just prose primitives.
 */
const descComponents = {
  p: P,
  a: A,
  code: Code,
  ul: List,
  ol: OL,
  li: Li,
  blockquote: Blockquote,
  pre: ({ children }: { children: React.ReactNode }) => <>{children}</>,
} as Record<string, unknown>

function renderDescNode(
  node: { type: string; lang?: string | null; value?: string; depth?: number },
  transform: (n: unknown) => React.ReactNode,
): React.ReactNode | undefined {
  // Fenced code blocks → editorial CodeBlock (no bleed inside the panel).
  if (node.type === 'code') {
    return <CodeBlock lang={node.lang ?? 'text'} bleed='none' showLineNumbers={false}>{node.value ?? ''}</CodeBlock>
  }
  // Headings inside a description render as a styled <h*> with no anchor/TOC
  // side effects (descriptions must not pollute the page table of contents).
  if (node.type === 'heading') {
    const level = Math.min(Math.max(node.depth ?? 2, 2), 4)
    const Tag = `h${level}` as 'h2' | 'h3' | 'h4'
    const children = (node as { children?: unknown[] }).children ?? []
    return <Tag className='font-semibold text-foreground'>{children.map((c, i) => <React.Fragment key={i}>{transform(c)}</React.Fragment>)}</Tag>
  }
  return undefined
}

/** Render a Markdown description string. Returns null for empty input. */
export function Desc({ children }: { children: string | undefined }) {
  if (!children) return null
  const markdown = children.trim()
  if (!markdown) return null
  return (
    <div className='flex flex-col gap-2 text-foreground'>
      <SafeMdxRenderer
        markdown={markdown}
        mdast={mdxParse(markdown)}
        components={descComponents as never}
        renderNode={renderDescNode as never}
        onError={() => {}}
      />
    </div>
  )
}

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

/* ── Helpers ──────────────────────────────────────────────────────────── */

function typeString(s: SchemaInfo | undefined): string {
  if (!s) return 'unknown'
  if (s.enum) return s.enum.map((v) => JSON.stringify(v)).join(' | ')
  if (s.oneOf) return s.oneOf.map(typeString).join(' | ')
  if (s.anyOf) return s.anyOf.map(typeString).join(' | ')
  if (s.type === 'array' && s.items) return `${typeString(s.items)}[]`
  let t = s.type ?? 'object'
  if (s.format) t += ` (${s.format})`
  if (s.nullable) t += ' | null'
  return t
}

function collectTags(s: SchemaInfo): { k: string; v: string }[] {
  const tags: { k: string; v: string }[] = []
  if (s.default !== undefined) tags.push({ k: 'Default', v: JSON.stringify(s.default) })
  if (s.pattern) tags.push({ k: 'Pattern', v: s.pattern })
  if (s.minimum !== undefined) tags.push({ k: 'Min', v: String(s.minimum) })
  if (s.maximum !== undefined) tags.push({ k: 'Max', v: String(s.maximum) })
  if (s.minLength !== undefined) tags.push({ k: 'Min length', v: String(s.minLength) })
  if (s.maxLength !== undefined) tags.push({ k: 'Max length', v: String(s.maxLength) })
  return tags
}

/* ── Property ─────────────────────────────────────────────────────────── */

function Property({ name, schema, required, depth = 0 }: {
  name: string
  schema: SchemaInfo
  required?: boolean
  depth?: number
}) {
  const objNested = schema.type === 'object' && schema.properties && Object.keys(schema.properties).length > 0
  const arrNested = schema.type === 'array' && schema.items?.type === 'object' && schema.items?.properties
  const canExpand = (objNested || arrNested) && depth <= 3
  const childSchema = arrNested ? schema.items! : schema
  const tags = collectTags(schema)

  return (
    <div className='flex flex-col gap-3 border-b border-border-subtle py-3 first:pt-0 last:border-b-0 last:pb-0'>
      <div className='flex flex-wrap items-center gap-2'>
        <span className='font-medium font-mono code-font-size text-primary'>
          {name}{required ? <span className='text-red'> *</span> : <span className='text-muted-foreground'>?</span>}
        </span>
        <span className='font-mono code-font-size text-muted-foreground'>{typeString(schema)}</span>
        {schema.deprecated && <NavBadge label='deprecated' color='yellow' />}
      </div>
      {schema.description && <Desc>{schema.description}</Desc>}
      {tags.length > 0 && (
        <div className='flex flex-wrap gap-2'>
          {tags.map((t) => (
            <span key={t.k} className='inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground'>
              <span className='font-medium'>{t.k}:</span> <code>{t.v}</code>
            </span>
          ))}
        </div>
      )}
      {canExpand && (
        <Expandable title={`Show ${arrNested ? 'item ' : ''}properties`}>
          <FieldList schema={childSchema} depth={depth + 1} />
        </Expandable>
      )}
    </div>
  )
}

/* ── Field list ───────────────────────────────────────────────────────── */

function FieldList({ schema, depth = 0 }: { schema: SchemaInfo; depth?: number }) {
  if (schema.properties && Object.keys(schema.properties).length > 0) {
    return (
      <div className='flex flex-col'>
        {Object.entries(schema.properties).map(([k, v]) => (
          <Property key={k} name={k} schema={v} required={(schema.required ?? []).includes(k)} depth={depth} />
        ))}
      </div>
    )
  }
  if (schema.type === 'array' && schema.items) {
    return <Property name='items' schema={schema.items} depth={depth} />
  }
  if (schema.type) {
    return <div className='text-muted-foreground'>Type: <code className='font-mono code-font-size'>{typeString(schema)}</code></div>
  }
  return null
}

/* ── Sections ─────────────────────────────────────────────────────────── */

function Section({ title, children }: { title: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className='flex flex-col gap-4'>
      <div className='font-semibold text-foreground'>{title}</div>
      <div className='flex flex-col'>
        {children}
      </div>
    </div>
  )
}

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
          <MethodBadge method={props.method} />
          <code className='code-font-size text-muted-foreground font-mono'>{props.path}</code>
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
