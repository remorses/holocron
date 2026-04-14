/**
 * Site-level `<Head>` contents (favicon, fonts, meta, theme script, colors).
 * Rendered once inside the layout handler (server component).
 *
 * The blocking theme script runs BEFORE first paint to set the `.dark`
 * class on `<html>`, preventing a flash of wrong theme. It reads the
 * `holocron-theme` cookie, falling back to the config default.
 */

import React from 'react'
import { Head } from 'spiceflow/react'
import type { HolocronConfig } from '../config.ts'

/* Blocking script that runs before paint. Sets `.dark` class on <html>
   based on cookie or config default. Must be synchronous and in <head>. */
/* Blocking script that runs before paint. Sets `.dark` class on <html>.
   When data-strict-theme is set, ignores the cookie and uses config default only. */
export const THEME_SCRIPT = `(function(){var d=document.documentElement;var strict=d.hasAttribute("data-strict-theme");var m=strict?null:document.cookie.match(/holocron-theme=(light|dark)/);var t=m?m[1]:null;if(!t){var def=d.getAttribute("data-default-theme")||"system";t=def==="system"?(window.matchMedia("(prefers-color-scheme:dark)").matches?"dark":"light"):def}if(t==="dark")d.classList.add("dark");else d.classList.remove("dark")})()`

/** Build Google Fonts URL for a family. Returns undefined if the family
 *  looks like a self-hosted font (has a source URL). */
function googleFontUrl(family: string, weight?: number): string {
  const w = weight ? `:wght@${weight}` : ''
  return `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}${w}&display=swap`
}

/** Build `@font-face` CSS for a self-hosted font. */
function fontFaceRule(family: string, source: string, format?: string, weight?: number): string {
  const fmt = format ? ` format('${format}')` : ''
  const w = weight ? `\n  font-weight: ${weight};` : ''
  return `@font-face {\n  font-family: '${family}';\n  src: url('${source}')${fmt};${w}\n  font-display: swap;\n}`
}

export function SiteHead({ config, titleOverride }: { config: HolocronConfig; titleOverride?: string }) {
  const { light: faviconLight, dark: faviconDark } = config.favicon
  const hasBoth =
    Boolean(faviconLight) && Boolean(faviconDark) && faviconLight !== faviconDark

  // Colors → CSS custom property overrides. Only inject when the user
  // actually configured colors (avoid overriding CSS defaults with the
  // normalize fallback of #000000).
  // Mintlify semantics: colors.dark = used for buttons/hover in light mode,
  // colors.light = used for emphasis in dark mode.
  // Colors → override link accent + brand primary when user configured colors.
  // Track presence via a flag so users can intentionally set black (#000000).
  const colorStyles: string[] = []
  if (config.colors._hasUserColors) {
    const lightBrand = config.colors.dark ?? config.colors.primary
    const darkBrand = config.colors.light ?? config.colors.primary
    colorStyles.push(`:root { --primary: ${lightBrand}; }`)
    colorStyles.push(`.dark { --primary: ${darkBrand}; }`)
  }

  // Fonts → Google Fonts <link> tags or @font-face rules
  const fontLinks: string[] = []
  const fontFaces: string[] = []
  const fontVarOverrides: string[] = []
  if (config.fonts) {
    const f = config.fonts
    // Main font family
    if (f.family) {
      if (f.source) {
        fontFaces.push(fontFaceRule(f.family, f.source, f.format, f.weight))
      } else {
        fontLinks.push(googleFontUrl(f.family, f.weight))
      }
      fontVarOverrides.push(`--font-sans: '${f.family}', system-ui, sans-serif;`)
    }
    // Heading override
    if (f.heading) {
      if (f.heading.source) {
        fontFaces.push(fontFaceRule(f.heading.family, f.heading.source, f.heading.format, f.heading.weight))
      } else {
        fontLinks.push(googleFontUrl(f.heading.family, f.heading.weight))
      }
      fontVarOverrides.push(`--font-heading: '${f.heading.family}', system-ui, sans-serif;`)
    }
    // Body override
    if (f.body) {
      if (f.body.source) {
        fontFaces.push(fontFaceRule(f.body.family, f.body.source, f.body.format, f.body.weight))
      } else {
        fontLinks.push(googleFontUrl(f.body.family, f.body.weight))
      }
      fontVarOverrides.push(`--font-body: '${f.body.family}', system-ui, sans-serif;`)
    }
  }

  const injectedStyles = [
    ...colorStyles,
    ...fontFaces,
    fontVarOverrides.length > 0 ? `:root { ${fontVarOverrides.join(' ')} }` : '',
  ].filter(Boolean).join('\n')

  return (
    <Head>
      {/* Theme styles and fonts are hoisted into <head> via spiceflow Head. */}
      <Head.Meta charSet='utf-8' />
      <Head.Meta name='viewport' content='width=device-width, initial-scale=1' />
      <link rel='preconnect' href='https://fonts.googleapis.com' />
      <link rel='preconnect' href='https://fonts.gstatic.com' crossOrigin='' />
      {/* Default fonts (Inter + Newsreader) — only if no custom font overrides */}
      {!config.fonts?.family && (
        <link href='https://rsms.me/inter/inter.css' rel='stylesheet' precedence='default' />
      )}
      {!config.fonts?.family && (
        <link
          href='https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,300..700;1,6..72,300..700&display=swap'
          rel='stylesheet'
          precedence='default'
        />
      )}
      {/* Custom Google Font links */}
      {fontLinks.map((url) => (
        <link key={url} href={url} rel='stylesheet' precedence='default' />
      ))}
      {/* Injected styles: colors + font-face + font var overrides */}
      {injectedStyles && (
        <style href='/holocron-injected-styles' precedence='default' dangerouslySetInnerHTML={{ __html: injectedStyles }} />
      )}
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
      {/* Custom SEO metatags — og:* uses property=, everything else uses name= */}
      {config.seo.metatags && Object.entries(config.seo.metatags)
        .filter(([name]) => name !== 'og:site_name') // avoid duplicating the built-in
        .map(([name, content]) => (
          name.startsWith('og:')
            ? <Head.Meta key={name} property={name} content={content} />
            : <Head.Meta key={name} name={name} content={content} />
        ))}
      <Head.Meta property='og:site_name' content={config.name} />
      <Head.Title>{titleOverride ?? config.name}</Head.Title>
    </Head>
  )
}
