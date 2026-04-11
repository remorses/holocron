/** Banner markdown renderer — compact inline-safe content that inherits shell colors. */

import React from 'react'
import type { RootContent } from 'mdast'
import { SafeMdxRenderer } from 'safe-mdx'

function BannerP({ children }: { children: React.ReactNode }) {
  return <span>{children}</span>
}

function BannerA({ href, children }: { href: string; children: React.ReactNode }) {
  const external = /^https?:\/\//.test(href) || href.startsWith('//')
  return (
    <a
      href={href}
      target={external ? '_blank' : undefined}
      rel={external ? 'noopener noreferrer' : undefined}
      className='font-medium underline underline-offset-2 transition-opacity hover:opacity-80'
      style={{ color: 'inherit' }}
    >
      {children}
    </a>
  )
}

function BannerCode({ children }: { children: React.ReactNode }) {
  return (
    <code className='px-1 [font-family:var(--font-code)] text-[11px]' style={{ color: 'inherit' }}>
      {children}
    </code>
  )
}

const bannerMdxComponents = {
  p: BannerP,
  a: BannerA,
  code: BannerCode,
}

export function RenderBannerNodes({ markdown, nodes }: { markdown: string; nodes: RootContent[] }) {
  return <SafeMdxRenderer markdown={markdown} mdast={{ type: 'root', children: nodes }} components={bannerMdxComponents} />
}
