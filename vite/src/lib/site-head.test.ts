/**
 * Tests for site-level head tags: fonts and analytics integration scripts.
 */

import { describe, expect, test } from 'vitest'
import { normalize } from './normalize-config.ts'
import { buildFontHeadState, buildAnalyticsScripts, buildColorStyles } from './site-head.tsx'

describe('SiteHead fonts', () => {
  test('does not emit third-party font links for the default font stack', () => {
    const state = buildFontHeadState(normalize({ name: 'Docs' }))

    expect(state.stylesheetLinks).toMatchInlineSnapshot(`[]`)
    expect(state.preconnectGoogle).toBe(false)
  })

  test('preconnects to Google only when custom Google font links are emitted', () => {
    const state = buildFontHeadState(normalize({ name: 'Docs', fonts: { family: 'Inter' } }))

    expect(state.preconnectGoogle).toBe(true)
    expect(state.stylesheetLinks).toMatchInlineSnapshot(`
      [
        "https://fonts.googleapis.com/css2?family=Inter&display=swap",
      ]
    `)
  })
})

describe('SiteHead colors', () => {
  test('derives light and dark primary tokens from configured primary color', () => {
    const styles = buildColorStyles(normalize({ name: 'Docs', colors: { primary: '#ff5500' } }))

    expect(styles).toMatchInlineSnapshot(`
      [
        ":root:root { --primary: #ff5500; }",
        ":root.dark { --primary: color-mix(in oklch, #ff5500 40%, white); }",
      ]
    `)
  })
})

describe('buildAnalyticsScripts', () => {
  test('returns empty arrays when no integrations configured', () => {
    const result = buildAnalyticsScripts({})
    expect(result.inlineScripts).toEqual([])
    expect(result.srcScripts).toEqual([])
  })

  test('returns empty arrays when integrations is undefined', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- testing defensive behavior
    const result = buildAnalyticsScripts(undefined!)
    expect(result.inlineScripts).toEqual([])
    expect(result.srcScripts).toEqual([])
  })

  test('Fathom produces a single src script with data-site', () => {
    const result = buildAnalyticsScripts({ fathom: { siteId: 'ABCDEF' } })
    expect(result.srcScripts).toMatchInlineSnapshot(`
      [
        {
          "attrs": {
            "data-site": "ABCDEF",
          },
          "key": "fathom",
          "src": "https://cdn.usefathom.com/script.js",
        },
      ]
    `)
    expect(result.inlineScripts).toEqual([])
  })

  test('GA4 produces a src loader and an inline config script', () => {
    const result = buildAnalyticsScripts({ ga4: { measurementId: 'G-12345' } })
    expect(result.srcScripts).toHaveLength(1)
    expect(result.srcScripts[0]!.src).toBe('https://www.googletagmanager.com/gtag/js?id=G-12345')
    expect(result.inlineScripts).toHaveLength(1)
    expect(result.inlineScripts[0]!.html).toContain('G-12345')
    expect(result.inlineScripts[0]!.html).toContain('gtag')
  })

  test('GTM produces an inline script', () => {
    const result = buildAnalyticsScripts({ gtm: { tagId: 'GTM-XXXX' } })
    expect(result.inlineScripts).toHaveLength(1)
    expect(result.inlineScripts[0]!.html).toContain('GTM-XXXX')
    expect(result.inlineScripts[0]!.html).toContain('gtm.js')
  })

  test('PostHog produces an inline script with apiKey and default apiHost', () => {
    const result = buildAnalyticsScripts({ posthog: { apiKey: 'phc_test123' } })
    expect(result.inlineScripts).toHaveLength(1)
    expect(result.inlineScripts[0]!.html).toContain('phc_test123')
    expect(result.inlineScripts[0]!.html).toContain('us.i.posthog.com')
  })

  test('PostHog uses custom apiHost when provided', () => {
    const result = buildAnalyticsScripts({ posthog: { apiKey: 'phc_test', apiHost: 'https://ph.example.com' } })
    expect(result.inlineScripts[0]!.html).toContain('ph.example.com')
  })

  test('Plausible produces a src script with data-domain', () => {
    const result = buildAnalyticsScripts({ plausible: { domain: 'example.com' } })
    expect(result.srcScripts).toMatchInlineSnapshot(`
      [
        {
          "attrs": {
            "data-domain": "example.com",
          },
          "key": "plausible",
          "src": "https://plausible.io/js/script.js",
        },
      ]
    `)
  })

  test('Pirsch produces a src script with data-code', () => {
    const result = buildAnalyticsScripts({ pirsch: { id: 'abc123' } })
    expect(result.srcScripts[0]!.attrs).toMatchInlineSnapshot(`
      {
        "data-code": "abc123",
        "id": "pianjs",
      }
    `)
  })

  test('Clarity produces an inline script with projectId', () => {
    const result = buildAnalyticsScripts({ clarity: { projectId: 'cl_test' } })
    expect(result.inlineScripts).toHaveLength(1)
    expect(result.inlineScripts[0]!.html).toContain('cl_test')
    expect(result.inlineScripts[0]!.html).toContain('clarity.ms')
  })

  test('multiple integrations can be configured at once', () => {
    const result = buildAnalyticsScripts({
      fathom: { siteId: 'F1' },
      plausible: { domain: 'docs.example.com' },
      clarity: { projectId: 'CL1' },
    })
    expect(result.srcScripts).toHaveLength(2) // fathom + plausible
    expect(result.inlineScripts).toHaveLength(1) // clarity
    expect(result.srcScripts.map(s => s.key)).toMatchInlineSnapshot(`
      [
        "fathom",
        "plausible",
      ]
    `)
  })

  test('Hotjar produces an inline script with hjid and hjsv', () => {
    const result = buildAnalyticsScripts({ hotjar: { hjid: '123456', hjsv: '6' } })
    expect(result.inlineScripts).toHaveLength(1)
    expect(result.inlineScripts[0]!.html).toContain('123456')
    expect(result.inlineScripts[0]!.html).toContain('hotjar')
  })

  test('Heap produces an inline script with appId', () => {
    const result = buildAnalyticsScripts({ heap: { appId: 'heap123' } })
    expect(result.inlineScripts).toHaveLength(1)
    expect(result.inlineScripts[0]!.html).toContain('heap123')
    expect(result.inlineScripts[0]!.html).toContain('heapanalytics.com')
  })

  test('Segment produces an inline script with write key', () => {
    const result = buildAnalyticsScripts({ segment: { key: 'seg_write_key' } })
    expect(result.inlineScripts).toHaveLength(1)
    expect(result.inlineScripts[0]!.html).toContain('seg_write_key')
    expect(result.inlineScripts[0]!.html).toContain('segment.com')
  })

  test('LogRocket produces a self-contained inline loader with onload init', () => {
    const result = buildAnalyticsScripts({ logrocket: { appId: 'lr/test' } })
    expect(result.srcScripts).toHaveLength(0)
    expect(result.inlineScripts).toHaveLength(1)
    expect(result.inlineScripts[0]!.html).toContain('lr/test')
    expect(result.inlineScripts[0]!.html).toContain('logr-in.com')
    expect(result.inlineScripts[0]!.html).toContain('onload')
  })

  test('Clearbit produces a src script with API key in URL', () => {
    const result = buildAnalyticsScripts({ clearbit: { publicApiKey: 'pk_abc' } })
    expect(result.srcScripts[0]!.src).toBe('https://tag.clearbitscripts.com/v1/pk_abc/tags.js')
  })

  test('Amplitude produces a self-contained inline loader with onload init', () => {
    const result = buildAnalyticsScripts({ amplitude: { apiKey: 'amp_key' } })
    expect(result.srcScripts).toHaveLength(0)
    expect(result.inlineScripts).toHaveLength(1)
    expect(result.inlineScripts[0]!.html).toContain('amp_key')
    expect(result.inlineScripts[0]!.html).toContain('amplitude.com')
    expect(result.inlineScripts[0]!.html).toContain('onload')
  })

  test('Mixpanel produces an inline script with project token', () => {
    const result = buildAnalyticsScripts({ mixpanel: { projectToken: 'mp_token' } })
    expect(result.inlineScripts).toHaveLength(1)
    expect(result.inlineScripts[0]!.html).toContain('mp_token')
    expect(result.inlineScripts[0]!.html).toContain('mxpnl.com')
  })

  test('escapes </script> in user-provided values to prevent XSS', () => {
    const malicious = 'G-X</script><script>alert(1)</script>'
    const result = buildAnalyticsScripts({ ga4: { measurementId: malicious } })
    const html = result.inlineScripts[0]!.html
    // Must not contain a raw closing tag
    expect(html).not.toContain('</script>')
    // The value should still be present, just escaped
    expect(html).toContain('\\u003c')
  })

  test('Plausible uses custom server when provided', () => {
    const result = buildAnalyticsScripts({
      plausible: { domain: 'docs.example.com', server: 'plausible.example.com' },
    })
    expect(result.srcScripts[0]!.src).toBe('https://plausible.example.com/js/script.js')
  })

  test('Plausible strips protocol from server if provided', () => {
    const result = buildAnalyticsScripts({
      plausible: { domain: 'docs.example.com', server: 'https://plausible.example.com/' },
    })
    expect(result.srcScripts[0]!.src).toBe('https://plausible.example.com/js/script.js')
  })
})
