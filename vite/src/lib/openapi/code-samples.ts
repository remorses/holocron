/**
 * OpenAPI `x-codeSamples` helpers for RequestExample MDX tabs.
 *
 * Mintlify / Redocly / Stainless / Speakeasy / hey-api all attach SDK snippets
 * as operation-level `x-codeSamples: [{ lang, label?, source }]`. Holocron
 * renders each sample as a titled code fence inside `<RequestExample>`.
 */

export interface OpenApiCodeSample {
  /** Prism / fence language id (normalized). */
  lang: string
  /** Tab label shown in RequestExample. */
  label: string
  /** Source code body. */
  source: string
}

/** Common aliases → Prism language ids. */
const LANG_ALIASES: Record<string, string> = {
  shell: 'bash',
  sh: 'bash',
  zsh: 'bash',
  curl: 'bash',
  js: 'javascript',
  'node.js': 'javascript',
  nodejs: 'javascript',
  node: 'javascript',
  ts: 'typescript',
  py: 'python',
  golang: 'go',
  csharp: 'csharp',
  'c#': 'csharp',
  'c++': 'cpp',
  rb: 'ruby',
  rs: 'rust',
  kt: 'kotlin',
  yml: 'yaml',
}

/** Safe fence-info language token (no whitespace / MDX injection). */
const SAFE_LANG = /^[a-z0-9][a-z0-9_+#.-]*$/

/** Normalize a sample `lang` for the code fence info string. */
export function toFenceLang(lang: string): string {
  const key = lang.trim().toLowerCase()
  const normalized = LANG_ALIASES[key] ?? key
  return SAFE_LANG.test(normalized) ? normalized : 'text'
}

/** Pick a backtick fence longer than any run inside `source` so nested ``` cannot close early. */
export function fenceMarker(source: string): string {
  let longest = 0
  for (const match of source.matchAll(/`+/g)) {
    if (match[0].length > longest) longest = match[0].length
  }
  return '`'.repeat(Math.max(3, longest + 1))
}

/** Escape a string for use inside a code-fence `title="..."` meta. */
export function fenceTitle(name: string): string {
  return name
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/`/g, "'")
    .replace(/[\r\n]+/g, ' ')
}

/**
 * Read `x-codeSamples` from an OpenAPI operation object.
 * Skips entries missing `lang` or a string `source` (including unresolved $refs).
 */
export function extractCodeSamples(operation: object | undefined): OpenApiCodeSample[] {
  if (!operation || typeof operation !== 'object') return []
  const raw = (operation as Record<string, unknown>)['x-codeSamples']
  if (!Array.isArray(raw)) return []

  const out: OpenApiCodeSample[] = []
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue
    const obj = entry as Record<string, unknown>
    const langRaw = obj.lang
    const source = obj.source
    if (typeof langRaw !== 'string' || !langRaw.trim()) continue
    if (typeof source !== 'string') continue
    const trimmed = source.replace(/^\n/, '').replace(/\n$/, '')
    if (!trimmed.trim()) continue
    const lang = toFenceLang(langRaw)
    const labelRaw = typeof obj.label === 'string' && obj.label.trim()
      ? obj.label.trim()
      : langRaw.trim()
    out.push({ lang, label: labelRaw, source: trimmed })
  }
  return out
}

/** Render code samples as titled fences for `<RequestExample>`. */
export function codeSampleFenceBlocks(samples: OpenApiCodeSample[]): string[] {
  return samples.flatMap((s) => {
    const fence = fenceMarker(s.source)
    return [
      `${fence}${s.lang} title="${fenceTitle(s.label)}" lines=false`,
      s.source,
      fence,
    ]
  })
}
