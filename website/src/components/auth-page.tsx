// Reusable centered auth layout used by login, device, and preview pages.
// Also exposes the shared Holocron logo used by auth pages and dashboard chrome.

import type { ReactNode } from 'react'
import { Head } from 'spiceflow/react'
import { cn } from '../lib/utils.ts'

export function HolocronLogo({ className, imageClassName = 'h-[30px]' }: { className?: string; imageClassName?: string }) {
  return (
    <span className={cn('inline-flex items-center', className)}>
      <img
        src="/api/ai-logo/holocron.jpeg"
        alt="Holocron"
        className={cn('w-auto mix-blend-multiply dark:hidden', imageClassName)}
      />
      <img
        src="/api/ai-logo/holocron.jpeg"
        alt="Holocron"
        className={cn('hidden w-auto invert mix-blend-screen dark:block', imageClassName)}
      />
    </span>
  )
}

export function AuthPage({
  title,
  visualTitle,
  headTitle,
  description,
  children,
  footer,
}: {
  title: string
  visualTitle?: ReactNode
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
          <h1 className="text-2xl font-semibold tracking-tight">{visualTitle ?? title}</h1>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        {children}
        {footer ? <div className="flex w-full flex-col gap-3">{footer}</div> : null}
      </div>
    </main>
  )
}
