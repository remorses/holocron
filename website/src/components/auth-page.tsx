// Reusable centered auth card layout used by login, device, and preview pages.
// Uses shadcn Card with header/content/footer slots.

import type { ReactNode } from 'react'
import { Head } from 'spiceflow/react'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/card.tsx'

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
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        {children ? <CardContent className="flex flex-col gap-4">{children}</CardContent> : null}
        {footer ? <CardFooter className="flex-col gap-3">{footer}</CardFooter> : null}
      </Card>
    </main>
  )
}
