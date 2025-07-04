import type { Metadata } from 'next'
import './globals.css'


export const metadata: Metadata = {
  title: 'MCP Tools Demo',
  description: 'Model Context Protocol tools rendered with Fumadocs OpenAPI components',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
