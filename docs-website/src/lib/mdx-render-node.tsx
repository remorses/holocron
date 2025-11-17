'use client'

import { CodeBlock, Pre } from 'fumadocs-ui/components/codeblock'
import { useState, useEffect } from 'react'
import { RenderNode } from 'safe-mdx'

export const renderNode: RenderNode = (node, transform) => {

  // if (node.type === 'strong') {
  //   return <span className='dark:text-blue-200'>{node.children?.map((child) => transform(child))}</span>
  // }
  // if (node.type === 'emphasis') {
  //   return <span className='dark:text-emerald-200'>{node.children?.map((child) => transform(child))}</span>
  // }
  // if (node.type === 'delete') {
  //   return <span className='dark:text-red-200 line-through'>{node.children?.map((child) => transform(child))}</span>
  // }
  // if (node.type === 'inlineCode') {
  //   return (
  //     <span className='dark:text-red-200 dark:bg-red-950/30 px-1 rounded font-mono text-[0.9em]'>{node.value}</span>
  //   )
  // }

  if (node.type === 'heading') {
    const startLine = node.position?.start?.line || 0
    const endLine = node.position?.end?.line || 0
    const id = node.data?.hProperties?.id || ''
    const Tag = `h${node.depth}` as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'

    return (
      <Tag
        id={id}
        data-markdown-line={startLine}
        data-comment-line-start={startLine}
        data-comment-line-end={endLine}
        data-commentable="true"
      >
        {node.children?.map((child) => transform(child))}
      </Tag>
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
