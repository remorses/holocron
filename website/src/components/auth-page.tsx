// Reusable centered auth layout used by login, device, and preview pages.
// Minimal Vercel-like design: no cards, no shadows, just centered typography.

import type { ReactNode } from 'react'
import { Head } from 'spiceflow/react'

export function AuthPage({
  title,
  headTitle,
  description,
  children,
  footer,
}: {
  title: string
  headTitle?: string
  description: string
  children?: ReactNode
  footer?: ReactNode
}) {
  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-16">
      <Head>
        <Head.Title>{`${headTitle ?? title} | Holocron`}</Head.Title>
        <Head.Meta name="description" content={description} />
      </Head>
      <div className="flex w-full max-w-sm flex-col items-center gap-6 text-center">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        {children}
        {footer ? <div className="flex w-full flex-col gap-3">{footer}</div> : null}
      </div>
    </main>
  )
}
