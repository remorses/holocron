/**
 * Shared JSON Schema rendering primitives.
 *
 * Used by both the OpenAPI endpoint renderer and the MCP tool renderer to
 * display schema properties, field lists, and markdown descriptions with
 * consistent styling. Extracted here to avoid duplication.
 */

import React from 'react'
import { SafeMdxRenderer } from 'safe-mdx'
import { mdxParse } from 'safe-mdx/parse'
import { Expandable } from '../components/markdown/expandable.tsx'
import { NavBadge } from '../components/layout/nav-badge.tsx'
import { P, A, Code } from '../components/markdown/typography.tsx'
import { List, OL, Li, Blockquote } from '../components/markdown/layout.tsx'
import { CodeBlock } from '../components/markdown/code-block.tsx'

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

/* ── Markdown descriptions ────────────────────────────────────────────── */

/**
 * Description fields in OpenAPI and MCP are Markdown by spec (headings,
 * lists, code, links, emphasis). Render them through safe-mdx with a
 * focused component map. The map is intentionally small — just prose
 * primitives, no nested MDX components.
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
  if (node.type === 'code') {
    return <CodeBlock lang={node.lang ?? 'text'} bleed='none' showLineNumbers={false}>{node.value ?? ''}</CodeBlock>
  }
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

/* ── Helpers ──────────────────────────────────────────────────────────── */

export function typeString(s: SchemaInfo | undefined): string {
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

export function collectTags(s: SchemaInfo): { k: string; v: string }[] {
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

export function Property({ name, schema, required, depth = 0 }: {
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

export function FieldList({ schema, depth = 0 }: { schema: SchemaInfo; depth?: number }) {
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

/* ── Section ──────────────────────────────────────────────────────────── */

export function Section({ title, children }: { title: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className='flex flex-col gap-4'>
      <div className='font-semibold text-foreground'>{title}</div>
      <div className='flex flex-col'>
        {children}
      </div>
    </div>
  )
}
