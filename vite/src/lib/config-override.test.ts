import { describe, it, expect } from 'vitest'
import {
  mergeConfigOverride,
  parseOverrideCookie,
  configToDialConfig,
  dialValuesToOverride,
  configOverrideToDocsJsonPartial,
  type ConfigOverride,
} from './config-override.ts'
import { getHolocronBaseUrl, holocronUrl } from './holocron-url.ts'
import type { HolocronConfig } from '../config.ts'

function makeBaseConfig(overrides: Partial<HolocronConfig> = {}): HolocronConfig {
  return {
    name: 'Test Docs',
    description: 'Test description',
    logo: { light: '/logo.svg' },
    favicon: { light: '/favicon.svg', dark: '/favicon.svg' },
    colors: { primary: '#0D9373', _hasUserColors: false },
    icons: { library: 'lucide' },
    appearance: { default: 'system', strict: false },
    navigation: { tabs: [], anchors: [], versions: [], dropdowns: [] },
    navbar: { links: [] },
    redirects: [],
    knownPaths: [],
    footer: { socials: {}, links: [] },
    search: {},
    seo: {},
    assistant: { enabled: true },
    decorativeLines: 'lines-with-dots',
    layout: { maxWidth: 1200, sidebarWidth: 230, columnGap: 60, radius: 10 },
    integrations: {},
    ...overrides,
  }
}

describe('mergeConfigOverride', () => {
  it('returns base config unchanged when override is empty', () => {
    const base = makeBaseConfig()
    const result = mergeConfigOverride(base, {})
    expect(result).toEqual(base)
    expect(result).not.toBe(base) // new object
  })

  it('merges colors partially and sets _hasUserColors', () => {
    const base = makeBaseConfig({ colors: { primary: '#000', _hasUserColors: false } })
    const override: ConfigOverride = { colors: { primary: '#ff0000' } }
    const result = mergeConfigOverride(base, override)
    expect(result.colors.primary).toBe('#ff0000')
    // _hasUserColors must be set to true so SiteHead injects CSS variables
    expect(result.colors._hasUserColors).toBe(true)
  })

  it('merges appearance partially', () => {
    const base = makeBaseConfig()
    const override: ConfigOverride = { appearance: { strict: true } }
    const result = mergeConfigOverride(base, override)
    expect(result.appearance.strict).toBe(true)
    expect(result.appearance.default).toBe('system')
  })

  it('overrides decorativeLines', () => {
    const base = makeBaseConfig()
    const override: ConfigOverride = { decorativeLines: 'dashed' }
    const result = mergeConfigOverride(base, override)
    expect(result.decorativeLines).toBe('dashed')
  })

  it('creates banner when base has none', () => {
    const base = makeBaseConfig()
    const override: ConfigOverride = { banner: { content: 'New banner!' } }
    const result = mergeConfigOverride(base, override)
    expect(result.banner).toEqual({ content: 'New banner!', dismissible: false })
  })

  it('merges banner when base has one', () => {
    const base = makeBaseConfig({ banner: { content: 'Old', dismissible: true } })
    const override: ConfigOverride = { banner: { content: 'Updated' } }
    const result = mergeConfigOverride(base, override)
    expect(result.banner).toEqual({ content: 'Updated', dismissible: true })
  })

  it('does not mutate the base config', () => {
    const base = makeBaseConfig()
    const original = JSON.parse(JSON.stringify(base))
    mergeConfigOverride(base, { colors: { primary: '#fff' } })
    expect(base).toEqual(original)
  })

  it('does not affect navigation or other structural fields', () => {
    const base = makeBaseConfig()
    const result = mergeConfigOverride(base, { colors: { primary: '#abc' } })
    expect(result.navigation).toBe(base.navigation)
    expect(result.redirects).toBe(base.redirects)
    expect(result.navbar).toBe(base.navbar)
  })
})

describe('parseOverrideCookie', () => {
  it('returns null for no cookie header', () => {
    expect(parseOverrideCookie(null)).toBeNull()
  })

  it('returns null when cookie is absent', () => {
    expect(parseOverrideCookie('other=value')).toBeNull()
  })

  it('parses doId and hash from cookie', () => {
    const result = parseOverrideCookie('holo-config-override=abc123def:sha256hash')
    expect(result).toEqual({ doId: 'abc123def', hash: 'sha256hash' })
  })

  it('handles colons in hash gracefully', () => {
    const result = parseOverrideCookie('holo-config-override=doId:hash:with:colons')
    expect(result).toEqual({ doId: 'doId', hash: 'hash:with:colons' })
  })

  it('returns null for malformed cookie (no colon)', () => {
    expect(parseOverrideCookie('holo-config-override=nodelimiter')).toBeNull()
  })
})

describe('configToDialConfig roundtrip', () => {
  it('converts config to dial format and back', () => {
    const base = makeBaseConfig({
      colors: { primary: '#ff5500', light: '#ffffff', dark: '#000000', _hasUserColors: true },
      decorativeLines: 'dashed',
      assistant: { enabled: false },
    })
    const dialConfig = configToDialConfig(base)
    // DialKit shows: light = color for light mode (Mintlify dark), dark = color for dark mode (Mintlify light)
    // Simulate DialKit returning the same values
    const dialValues = {
      colors: { light: '#000000', dark: '#ffffff' },
      decorativeLines: 'dashed',
      assistant: { enabled: false },
    }
    const override = dialValuesToOverride(dialValues)
    // light dial value → primary + dark (Mintlify convention)
    expect(override.colors?.primary).toBe('#000000')
    expect(override.colors?.dark).toBe('#000000')
    // dark dial value → light (Mintlify convention)
    expect(override.colors?.light).toBe('#ffffff')
    expect(override.decorativeLines).toBe('dashed')
    expect(override.assistant?.enabled).toBe(false)
  })

  it('skips empty color strings', () => {
    const dialValues = {
      colors: { light: '', dark: '' },
    }
    const override = dialValuesToOverride(dialValues)
    expect(override.colors?.primary).toBeUndefined()
    expect(override.colors?.light).toBeUndefined()
    expect(override.colors?.dark).toBeUndefined()
  })
})

describe('configOverrideToDocsJsonPartial', () => {
  it('produces clean JSON for clipboard', () => {
    const override: ConfigOverride = {
      colors: { primary: '#ff0000' },
      decorativeLines: 'none',
      assistant: { enabled: false },
    }
    const result = configOverrideToDocsJsonPartial(override)
    expect(result).toMatchInlineSnapshot(`
      {
        "assistant": {
          "enabled": false,
        },
        "colors": {
          "primary": "#ff0000",
        },
        "decorativeLines": "none",
      }
    `)
  })

  it('omits empty sections', () => {
    const override: ConfigOverride = {}
    const result = configOverrideToDocsJsonPartial(override)
    expect(result).toEqual({})
  })
})

describe('holocronUrl', () => {
  it('defaults to holocron.so', () => {
    const previous = process.env.HOLOCRON_URL
    delete process.env.HOLOCRON_URL
    try {
      expect(getHolocronBaseUrl()).toMatchInlineSnapshot(`"https://holocron.so"`)
      expect(holocronUrl('/api/config-override')).toMatchInlineSnapshot(`"https://holocron.so/api/config-override"`)
    } finally {
      if (previous === undefined) delete process.env.HOLOCRON_URL
      else process.env.HOLOCRON_URL = previous
    }
  })

  it('uses HOLOCRON_URL without duplicating slashes', () => {
    const previous = process.env.HOLOCRON_URL
    process.env.HOLOCRON_URL = 'https://custom.example.com/'
    try {
      expect(getHolocronBaseUrl()).toMatchInlineSnapshot(`"https://custom.example.com"`)
      expect(holocronUrl('/api/og?title=Hello')).toMatchInlineSnapshot(`"https://custom.example.com/api/og?title=Hello"`)
    } finally {
      if (previous === undefined) delete process.env.HOLOCRON_URL
      else process.env.HOLOCRON_URL = previous
    }
  })
})
