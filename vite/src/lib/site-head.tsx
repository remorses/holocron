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
function fontFaceRule({
  family,
  source,
  format,
  weight,
}: {
  family: string
  source: string
  format?: string
  weight?: number
}): string {
  const fmt = format ? ` format('${format}')` : ''
  const w = weight ? `\n  font-weight: ${weight};` : ''
  return `@font-face {\n  font-family: '${family}';\n  src: url('${source}')${fmt};${w}\n  font-display: swap;\n}`
}

export type FontHeadState = {
  stylesheetLinks: string[]
  fontFaces: string[]
  fontVarOverrides: string[]
  preconnectGoogle: boolean
}

export function buildFontHeadState(config: HolocronConfig): FontHeadState {
  const stylesheetLinks = new Set<string>()
  const fontFaces: string[] = []
  const fontVarOverrides: string[] = []

  const addFont = ({
    family,
    weight,
    source,
    format,
    variable,
  }: {
    family: string
    weight?: number
    source?: string
    format?: 'woff' | 'woff2'
    variable: '--font-sans' | '--font-heading' | '--font-body'
  }) => {
    if (source) {
      fontFaces.push(fontFaceRule({ family, source, format, weight }))
    } else {
      stylesheetLinks.add(googleFontUrl(family, weight))
    }
    fontVarOverrides.push(`${variable}: '${family}', system-ui, sans-serif;`)
  }

  const f = config.fonts
  if (f?.family) {
    addFont({
      family: f.family,
      weight: f.weight,
      source: f.source,
      format: f.format,
      variable: '--font-sans',
    })
  }
  if (f?.heading) {
    addFont({ ...f.heading, variable: '--font-heading' })
  }
  if (f?.body) {
    addFont({ ...f.body, variable: '--font-body' })
  }

  return {
    stylesheetLinks: [...stylesheetLinks],
    fontFaces,
    fontVarOverrides,
    preconnectGoogle: stylesheetLinks.size > 0,
  }
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
    // When the user doesn't set colors.light, auto-derive a lighter variant
    // for dark mode via color-mix. 40% of the original + 60% white ≈ Tailwind 200 scale.
    const darkBrand = config.colors.light ?? `color-mix(in oklch, ${config.colors.primary} 40%, white)`
    colorStyles.push(`:root { --primary: ${lightBrand}; }`)
    colorStyles.push(`.dark { --primary: ${darkBrand}; }`)
  }

  const fontHead = buildFontHeadState(config)

  const injectedStyles = [
    ...colorStyles,
    ...fontHead.fontFaces,
    fontHead.fontVarOverrides.length > 0 ? `:root { ${fontHead.fontVarOverrides.join(' ')} }` : '',
  ].filter(Boolean).join('\n')

  return (
    <Head>
      {/* Theme styles and fonts are hoisted into <head> via spiceflow Head. */}
      <Head.Meta charSet='utf-8' />
      <Head.Meta name='viewport' content='width=device-width, initial-scale=1' />
      {fontHead.preconnectGoogle && (
        <>
          <link rel='preconnect' href='https://fonts.googleapis.com' />
          <link rel='preconnect' href='https://fonts.gstatic.com' crossOrigin='' />
        </>
      )}
      {/* Custom Google Font links */}
      {fontHead.stylesheetLinks.map((url) => (
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
