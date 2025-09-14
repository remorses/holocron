'use client'

import { CodeBlock, Pre } from 'fumadocs-ui/components/codeblock'
import { useState, useEffect } from 'react'
import { RenderNode } from 'safe-mdx'

export const renderNode: RenderNode = (node, transform) => {
  // TODO only enable colored bold in chat?
  if (node.type === 'strong') {
    return <span className='dark:text-blue-200'>{node.children?.map((child) => transform(child))}</span>
  }
  if (node.type === 'emphasis') {
    return <span className='dark:text-emerald-200'>{node.children?.map((child) => transform(child))}</span>
  }
  if (node.type === 'delete') {
    return <span className='dark:text-red-200 line-through'>{node.children?.map((child) => transform(child))}</span>
  }
  if (node.type === 'inlineCode') {
    return (
      <span className='dark:text-red-200 dark:bg-red-950/30 px-1 rounded font-mono text-[0.9em]'>{node.value}</span>
    )
  }

  if (node.type === 'code') {
    const language = node.lang || ''

    const html = node.data?.['html']
    const props = {
      title: '',
      ...(node.data?.hProperties ?? {}),

      lang: language,
    }

    return (
      <CodeBlock {...props}>
        <Pre>{html ? <div className='content' dangerouslySetInnerHTML={{ __html: html }}></div> : node.value}</Pre>
      </CodeBlock>
    )
  }
}
