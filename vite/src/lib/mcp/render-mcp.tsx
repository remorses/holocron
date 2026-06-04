/**
 * MCP tool and resource renderers — server components.
 *
 * MCPTool renders the documentation page body for an MCP tool: name, description,
 * annotations badges, and input schema as a field list.
 *
 * MCPResource renders a resource page: name, URI, MIME type badge, description.
 *
 * Shared schema rendering primitives (Property, FieldList, Desc, Section) live
 * in render-schema.tsx to avoid duplication with the OpenAPI renderer.
 */

import React from 'react'
import { NavBadge } from '../../components/layout/nav-badge.tsx'
import { Desc, FieldList, Section, type SchemaInfo } from '../render-schema.tsx'

/* ── MCPTool ──────────────────────────────────────────────────────────── */

export interface MCPToolProps {
  name: string
  description?: string
  inputSchema?: SchemaInfo
  outputSchema?: SchemaInfo
  annotations?: {
    title?: string
    readOnlyHint?: boolean
    destructiveHint?: boolean
    idempotentHint?: boolean
    openWorldHint?: boolean
  }
  execution?: {
    taskSupport?: 'optional' | 'required' | 'forbidden'
  }
  title?: string
}

export function MCPTool(props: MCPToolProps) {
  const schema = props.inputSchema
  const outputSchema = props.outputSchema
  const annotations = props.annotations
  const execution = props.execution
  const hasParams = schema?.properties && Object.keys(schema.properties).length > 0
  const hasOutput = outputSchema?.properties && Object.keys(outputSchema.properties).length > 0

  // Collect all badges with tooltip descriptions from the MCP spec
  const badges: { label: string; color: string; tooltip: string }[] = []
  if (annotations?.readOnlyHint) badges.push({
    label: 'read-only', color: 'green',
    tooltip: 'This tool does not modify its environment',
  })
  if (annotations?.idempotentHint) badges.push({
    label: 'idempotent', color: 'blue',
    tooltip: 'Calling this tool repeatedly with the same arguments has no additional effect',
  })
  if (annotations?.destructiveHint) badges.push({
    label: 'destructive', color: 'red',
    tooltip: 'This tool may perform destructive updates to its environment',
  })
  if (annotations?.openWorldHint === false) badges.push({
    label: 'closed-world', color: 'yellow',
    tooltip: 'This tool operates in a closed domain (e.g. a memory tool), not an open world like web search',
  })
  if (execution?.taskSupport === 'required' || execution?.taskSupport === 'optional') {
    badges.push({
      label: 'long-running', color: 'orange',
      tooltip: `This tool supports long-running tasks (${execution!.taskSupport})`,
    })
  }

  return (
    <div className='flex flex-col gap-(--prose-gap) text-sm'>
      {/* Header */}
      <div className='flex flex-col gap-2'>
        <div className='flex items-center gap-3'>
          <code className='code-font-size text-foreground font-mono font-semibold'>{props.name}</code>
          <NavBadge label='TOOL' color='purple' />
        </div>
        {props.description && <Desc>{props.description}</Desc>}
      </div>

      {/* Annotation + execution badges */}
      {badges.length > 0 && (
        <div className='flex flex-wrap gap-2'>
          {badges.map((b) => (
            <span key={b.label} title={b.tooltip} className='cursor-help'>
              <NavBadge label={b.label} color={b.color} />
            </span>
          ))}
        </div>
      )}

      {/* Parameters */}
      {hasParams && (
        <Section title='Parameters'>
          <FieldList schema={schema!} />
        </Section>
      )}

      {/* Output schema */}
      {hasOutput && (
        <Section title='Response'>
          <FieldList schema={outputSchema!} />
        </Section>
      )}
    </div>
  )
}

/* ── MCPResource ──────────────────────────────────────────────────────── */

export interface MCPResourceProps {
  name: string
  uri: string
  description?: string
  mimeType?: string
}

export function MCPResource(props: MCPResourceProps) {
  return (
    <div className='flex flex-col gap-(--prose-gap) text-sm'>
      <div className='flex flex-col gap-2'>
        <div className='flex items-center gap-3'>
          <code className='code-font-size text-foreground font-mono font-semibold'>{props.name}</code>
          <NavBadge label='SOURCE' color='blue' />
        </div>
        <div className='flex items-center gap-2'>
          <code className='code-font-size text-muted-foreground font-mono'>{props.uri}</code>
          {props.mimeType && (
            <span className='inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground'>
              {props.mimeType}
            </span>
          )}
        </div>
        {props.description && <Desc>{props.description}</Desc>}
      </div>
    </div>
  )
}
