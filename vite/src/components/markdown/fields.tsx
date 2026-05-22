'use client'

/** Mintlify-compatible API field components. */

import React from 'react'
import { Badge } from './badge.tsx'
import { SectionCard } from './shared.tsx'

export function ParamField(props: {
  children: React.ReactNode
  type?: string
  required?: boolean
  deprecated?: boolean
  default?: string
  placeholder?: string
  path?: string
  query?: string
  body?: string
  header?: string
}) {
  const location = [
    ['path', props.path],
    ['query', props.query],
    ['body', props.body],
    ['header', props.header],
  ].find(([, value]) => value)
  const name = location?.[1] ?? 'field'
  return (
    <SectionCard>
      <div className='flex flex-col gap-2 text-sm'>
        <div className='flex flex-wrap items-center gap-2'>
          <code className='inline-code'>{location?.[0]} {name}</code>
          {props.type && <Badge color='surface'>{props.type}</Badge>}
          {props.required && <Badge color='green'>required</Badge>}
          {props.deprecated && <Badge color='orange'>deprecated</Badge>}
          {props.default && <Badge color='gray'>default: {props.default}</Badge>}
        </div>
        <div className='flex flex-col gap-3 text-muted-foreground'>{props.children}</div>
      </div>
    </SectionCard>
  )
}

export function ResponseField({
  name,
  type,
  required,
  deprecated,
  children,
}: {
  name: string
  type: string
  required?: boolean
  deprecated?: boolean
  children?: React.ReactNode
}) {
  return (
    <SectionCard>
      <div className='flex flex-col gap-2 text-sm'>
        <div className='flex flex-wrap items-center gap-2'>
          <code className='inline-code'>{name}</code>
          <Badge color='surface'>{type}</Badge>
          {required && <Badge color='green'>required</Badge>}
          {deprecated && <Badge color='orange'>deprecated</Badge>}
        </div>
        {children !== undefined && children !== null && <div className='flex flex-col gap-3 text-muted-foreground'>{children}</div>}
      </div>
    </SectionCard>
  )
}
