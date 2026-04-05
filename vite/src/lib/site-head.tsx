/**
 * Site-level `<Head>` contents (favicon links, fonts, og:* meta).
 * Rendered once inside the layout handler.
 */

import React from 'react'
import { Head } from 'spiceflow/react'
import type { HolocronConfig } from '../config.ts'

export function SiteHead({ config }: { config: HolocronConfig }) {
  // Favicon: emit a single <link> when only one variant is set (or when
  // both normalize to the same asset), or two with prefers-color-scheme
  // media queries when the user explicitly provided distinct light/dark
  // files.
  const { light: faviconLight, dark: faviconDark } = config.favicon
  const hasBoth =
    Boolean(faviconLight) && Boolean(faviconDark) && faviconLight !== faviconDark
  return (
    <Head>
      <Head.Meta charSet='utf-8' />
      <Head.Meta name='viewport' content='width=device-width, initial-scale=1' />
      <link rel='preconnect' href='https://fonts.googleapis.com' />
      <link rel='preconnect' href='https://fonts.gstatic.com' crossOrigin='' />
      <link href='https://rsms.me/inter/inter.css' rel='stylesheet' precedence='default' />
      <link
        href='https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,300..700;1,6..72,300..700&display=swap'
        rel='stylesheet'
        precedence='default'
      />
      {hasBoth ? (
        <>
          <link rel='icon' href={faviconLight} media='(prefers-color-scheme: light)' />
          <link rel='icon' href={faviconDark} media='(prefers-color-scheme: dark)' />
        </>
      ) : (
        (faviconLight || faviconDark) && (
          <link rel='icon' href={faviconLight || faviconDark} />
        )
      )}
      {config.description && (
        <>
          <Head.Meta name='description' content={config.description} />
          <Head.Meta property='og:description' content={config.description} />
        </>
      )}
      <Head.Meta property='og:site_name' content={config.name} />
      <Head.Title>{config.name}</Head.Title>
    </Head>
  )
}
