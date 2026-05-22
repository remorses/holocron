/**
 * Site-level `<Head>` contents (favicon, fonts, meta, theme script, colors,
 * analytics integration scripts).
 * Rendered once inside the layout handler (server component).
 *
 * The blocking theme script runs BEFORE first paint to set the `.dark`
 * class on `<html>`, preventing a flash of wrong theme. It reads the
 * `holocron-theme` cookie, falling back to the config default.
 *
 * Analytics scripts are injected as async/deferred `<script>` tags in the
 * `<head>`. Each provider's snippet is built from the user's
 * `integrations.*` config and rendered via dangerouslySetInnerHTML.
 * GTM also needs a `<noscript>` iframe in `<body>` — that's exported
 * separately as `GtmNoscript` for use in the body layout.
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

function stableHash(value: string): string {
  let hash = 0
  for (let i = 0; i < value.length; i++) {
    hash = (Math.imul(31, hash) + value.charCodeAt(i)) | 0
  }
  return Math.abs(hash).toString(36)
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
    colorStyles.push(`:root:root { --primary: ${lightBrand}; }`)
    colorStyles.push(`:root.dark { --primary: ${darkBrand}; }`)
  }

  const fontHead = buildFontHeadState(config)

  const injectedStyles = [
    ...colorStyles,
    ...fontHead.fontFaces,
    fontHead.fontVarOverrides.length > 0 ? `:root { ${fontHead.fontVarOverrides.join(' ')} }` : '',
  ].filter(Boolean).join('\n')
  const injectedStylesHref = `/holocron-injected-styles?${stableHash(injectedStyles)}`

  const { inlineScripts: analyticsScripts, srcScripts: analyticsSrcScripts } = buildAnalyticsScripts(config.integrations)

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
        <style href={injectedStylesHref} precedence='default' dangerouslySetInnerHTML={{ __html: injectedStyles }} />
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
      {/* Analytics integration scripts */}
      {analyticsScripts.map(({ key, html }) => (
        <script key={key} dangerouslySetInnerHTML={{ __html: html }} />
      ))}
      {analyticsSrcScripts.map(({ key, src, attrs }) => (
        <script key={key} src={src} defer {...attrs} />
      ))}
    </Head>
  )
}

/* ── Analytics integration scripts ────────────────────────────────────── */

type InlineScript = { key: string; html: string }
type SrcScript = { key: string; src: string; attrs?: Record<string, string> }

/**
 * Escape a string for safe embedding inside a `<script>` tag's
 * `dangerouslySetInnerHTML`. `JSON.stringify` handles quotes and
 * newlines but does NOT escape `</script>` — a value containing that
 * literal closes the tag early, enabling XSS. We replace every `<` with
 * its Unicode escape so the browser never sees a closing tag boundary.
 */
function scriptJson(value: string): string {
  return JSON.stringify(value).replace(/</g, '\\u003c')
}

/**
 * Build analytics script tags from the integrations config.
 * Returns two arrays: inline scripts (dangerouslySetInnerHTML) and
 * external src scripts (simple <script src="..." defer>).
 *
 * For providers that need an external loader before an inline init
 * (Amplitude, LogRocket), the init is self-contained: it waits for the
 * global to exist via the loader's onload, or uses a polling guard.
 * The official snippets for these providers use inline loaders that
 * create the script element themselves, so the init runs after load.
 */
export function buildAnalyticsScripts(
  integrations: HolocronConfig['integrations'],
): { inlineScripts: InlineScript[]; srcScripts: SrcScript[] } {
  const inlineScripts: InlineScript[] = []
  const srcScripts: SrcScript[] = []
  if (!integrations) return { inlineScripts, srcScripts }

  // Fathom — single deferred script with data-site attribute
  if (integrations.fathom?.siteId) {
    srcScripts.push({
      key: 'fathom',
      src: 'https://cdn.usefathom.com/script.js',
      attrs: { 'data-site': integrations.fathom.siteId },
    })
  }

  // Google Analytics 4 — async gtag.js loader + config
  // The inline config script runs immediately (gtag queues calls into
  // dataLayer before the async loader finishes, so ordering is safe).
  if (integrations.ga4?.measurementId) {
    const id = integrations.ga4.measurementId
    srcScripts.push({
      key: 'ga4-loader',
      src: `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`,
    })
    inlineScripts.push({
      key: 'ga4-config',
      html: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config',${scriptJson(id)});`,
    })
  }

  // Google Tag Manager — inline IIFE that creates the script element
  // itself, so no ordering issue.
  if (integrations.gtm?.tagId) {
    const id = integrations.gtm.tagId
    inlineScripts.push({
      key: 'gtm',
      html: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer',${scriptJson(id)});`,
    })
  }

  // PostHog — self-contained inline snippet that creates its own script
  // element. No external src needed.
  if (integrations.posthog?.apiKey) {
    const apiKey = integrations.posthog.apiKey
    const apiHost = integrations.posthog.apiHost || 'https://us.i.posthog.com'
    inlineScripts.push({
      key: 'posthog',
      html: `!function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.crossOrigin="anonymous",p.async=!0,p.src=s.api_host.replace(".i.posthog.com","-assets.i.posthog.com")+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="init capture register register_once register_for_session unregister unregister_for_session getFeatureFlag getFeatureFlagPayload isFeatureEnabled reloadFeatureFlags updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures on onFeatureFlags onSessionId getSurveys getActiveMatchingSurveys renderSurvey canRenderSurvey getNextSurveyStep identify setPersonProperties group resetGroups setPersonPropertiesForFlags resetPersonPropertiesForFlags setGroupPropertiesForFlags resetGroupPropertiesForFlags reset get_distinct_id getGroups get_session_id get_session_replay_url alias set_config startSessionRecording stopSessionRecording sessionRecordingStarted captureException loadToolbar get_property getSessionProperty createPersonProfile opt_in_capturing opt_out_capturing has_opted_in_capturing has_opted_out_capturing clear_opt_in_out_capturing debug".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);posthog.init(${scriptJson(apiKey)},{api_host:${scriptJson(apiHost)}});`,
    })
  }

  // Plausible — single deferred script with data-domain.
  // Supports self-hosted instances via `server` field.
  if (integrations.plausible?.domain) {
    const plausible = integrations.plausible as { domain: string; server?: string }
    const host = plausible.server
      ? `https://${plausible.server.replace(/^https?:\/\//, '').replace(/\/+$/, '')}`
      : 'https://plausible.io'
    srcScripts.push({
      key: 'plausible',
      src: `${host}/js/script.js`,
      attrs: { 'data-domain': plausible.domain },
    })
  }

  // Mixpanel — self-contained inline snippet that creates its own
  // script element. No external src needed.
  if (integrations.mixpanel?.projectToken) {
    const token = integrations.mixpanel.projectToken
    inlineScripts.push({
      key: 'mixpanel',
      html: `(function(f,b){if(!b.__SV){var e,g,i,h;window.mixpanel=b;b._i=[];b.init=function(e,f,c){function g(a,d){var b=d.split(".");2==b.length&&(a=a[b[0]],d=b[1]);a[d]=function(){a.push([d].concat(Array.prototype.slice.call(arguments,0)))}}var a=b;"undefined"!==typeof c?a=b[c]=[]:c="mixpanel";a.people=a.people||[];a.toString=function(a){var d="mixpanel";"mixpanel"!==c&&(d+="."+c);a||(d+=" (stub)");return d};a.people.toString=function(){return a.toString(1)+".people (stub)"};i="disable time_event track track_pageview track_links track_forms track_with_groups add_group set_group remove_group register register_once alias unregister identify name_tag set_config reset opt_in_tracking opt_out_tracking has_opted_in_tracking has_opted_out_tracking clear_opt_in_out_tracking start_batch_senders people.set people.set_once people.unset people.increment people.append people.union people.track_charge people.clear_charges people.delete_user people.remove".split(" ");for(h=0;h<i.length;h++)g(a,i[h]);var j="undefined"!==typeof f?f:{};b._i.push([e,j,c])};b.__SV=1.2;e=f.createElement("script");e.type="text/javascript";e.async=!0;e.src="undefined"!==typeof MIXPANEL_CUSTOM_LIB_URL?MIXPANEL_CUSTOM_LIB_URL:"file:"===f.location.protocol&&"//cdn.mxpnl.com/libs/mixpanel-2-latest.min.js".match(/^\\/\\//)?"https://cdn.mxpnl.com/libs/mixpanel-2-latest.min.js":"//cdn.mxpnl.com/libs/mixpanel-2-latest.min.js";g=f.getElementsByTagName("script")[0];g.parentNode.insertBefore(e,g)}})(document,window.mixpanel||[]);mixpanel.init(${scriptJson(token)});`,
    })
  }

  // Amplitude — self-contained inline loader. The CDN script sets up
  // the global, then we init. Using an inline loader that creates the
  // script element guarantees correct ordering.
  if (integrations.amplitude?.apiKey) {
    const apiKey = integrations.amplitude.apiKey
    inlineScripts.push({
      key: 'amplitude',
      html: `!function(){var e=${scriptJson(apiKey)},s=document.createElement("script");s.type="text/javascript";s.async=!0;s.src="https://cdn.amplitude.com/script/"+encodeURIComponent(e)+".js";s.onload=function(){window.amplitude&&window.amplitude.init(e,{autocapture:{pageViews:true,sessions:true}})};var t=document.getElementsByTagName("script")[0];t.parentNode.insertBefore(s,t)}();`,
    })
  }

  // Hotjar — inline IIFE with hjSettings
  if (integrations.hotjar?.hjid) {
    const hjid = integrations.hotjar.hjid
    const hjsv = integrations.hotjar.hjsv || '6'
    inlineScripts.push({
      key: 'hotjar',
      html: `(function(h,o,t,j,a,r){h.hj=h.hj||function(){(h.hj.q=h.hj.q||[]).push(arguments)};h._hjSettings={hjid:${scriptJson(hjid)},hjsv:${scriptJson(hjsv)}};a=o.getElementsByTagName('head')[0];r=o.createElement('script');r.async=1;r.src=t+h._hjSettings.hjid+j+h._hjSettings.hjsv;a.appendChild(r);})(window,document,'https://static.hotjar.com/c/hotjar-','.js?sv=');`,
    })
  }

  // Pirsch — single deferred script with data-code
  if (integrations.pirsch?.id) {
    srcScripts.push({
      key: 'pirsch',
      src: 'https://api.pirsch.io/pa.js',
      attrs: { 'data-code': integrations.pirsch.id, id: 'pianjs' },
    })
  }

  // Heap — self-contained inline loader that creates the script element
  if (integrations.heap?.appId) {
    const appId = integrations.heap.appId
    inlineScripts.push({
      key: 'heap',
      html: `window.heap=window.heap||[],heap.load=function(e,t){window.heap.appid=e,window.heap.config=t=t||{};var r=document.createElement("script");r.type="text/javascript",r.async=!0,r.src="https://cdn.heapanalytics.com/js/heap-"+e+".js";var a=document.getElementsByTagName("script")[0];a.parentNode.insertBefore(r,a);for(var n=function(e){return function(){heap.push([e].concat(Array.prototype.slice.call(arguments,0)))}},p=["addEventProperties","addUserProperties","clearEventProperties","identify","resetIdentity","removeEventProperty","setEventProperties","track","unsetEventProperty"],o=0;o<p.length;o++)heap[p[o]]=n(p[o])};heap.load(${scriptJson(appId)});`,
    })
  }

  // Segment — self-contained analytics.js CDN snippet
  if (integrations.segment?.key) {
    const key = integrations.segment.key
    inlineScripts.push({
      key: 'segment',
      html: `!function(){var i="analytics",analytics=window[i]=window[i]||[];if(!analytics.initialize)if(analytics.invoked)window.console&&console.error&&console.error("Segment snippet included twice.");else{analytics.invoked=!0;analytics.methods=["trackSubmit","trackClick","trackLink","trackForm","pageview","identify","reset","group","track","ready","alias","debug","page","screen","once","off","on","addSourceMiddleware","addIntegrationMiddleware","setAnonymousId","addDestinationMiddleware","register"];analytics.factory=function(e){return function(){var t=Array.prototype.slice.call(arguments);t.unshift(e);analytics.push(t);return analytics}};for(var e=0;e<analytics.methods.length;e++){var key=analytics.methods[e];analytics[key]=analytics.factory(key)}analytics.load=function(key,e){var t=document.createElement("script");t.type="text/javascript";t.async=!0;t.src="https://cdn.segment.com/analytics.js/v1/"+key+"/analytics.min.js";var n=document.getElementsByTagName("script")[0];n.parentNode.insertBefore(t,n);analytics._loadOptions=e};analytics._writeKey=${scriptJson(key)};analytics.SNIPPET_VERSION="5.2.1";analytics.load(${scriptJson(key)});analytics.page()}}();`,
    })
  }

  // Microsoft Clarity — inline loader
  if (integrations.clarity?.projectId) {
    const projectId = integrations.clarity.projectId
    inlineScripts.push({
      key: 'clarity',
      html: `(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window,document,"clarity","script",${scriptJson(projectId)});`,
    })
  }

  // LogRocket — self-contained inline loader. Creates the script
  // element and calls init in onload to guarantee correct ordering.
  if (integrations.logrocket?.appId) {
    const appId = integrations.logrocket.appId
    inlineScripts.push({
      key: 'logrocket',
      html: `!function(){var e=${scriptJson(appId)},s=document.createElement("script");s.type="text/javascript";s.async=!0;s.crossOrigin="anonymous";s.src="https://cdn.logr-in.com/LogRocket.min.js";s.onload=function(){window.LogRocket&&window.LogRocket.init(e)};var t=document.getElementsByTagName("script")[0];t.parentNode.insertBefore(s,t)}();`,
    })
  }

  // Clearbit — single script tag with API key in URL
  if (integrations.clearbit?.publicApiKey) {
    srcScripts.push({
      key: 'clearbit',
      src: `https://tag.clearbitscripts.com/v1/${encodeURIComponent(integrations.clearbit.publicApiKey)}/tags.js`,
      attrs: { referrerpolicy: 'strict-origin-when-cross-origin' },
    })
  }

  return { inlineScripts, srcScripts }
}

/**
 * GTM requires a `<noscript>` iframe immediately after the opening `<body>` tag
 * for tracking visitors with JavaScript disabled. Render this component in the
 * body layout, not in `<Head>`.
 */
export function GtmNoscript({ integrations }: { integrations: HolocronConfig['integrations'] }) {
  if (!integrations?.gtm?.tagId) return null
  const id = integrations.gtm.tagId
  return (
    <noscript>
      <iframe
        src={`https://www.googletagmanager.com/ns.html?id=${encodeURIComponent(id)}`}
        height={0}
        width={0}
        style={{ display: 'none', visibility: 'hidden' }}
      />
    </noscript>
  )
}
