/**
 * Lightweight YAML frontmatter parser vendored for Holocron's page metadata path.
 */

import { parseDocument } from 'yaml'

function extractYamlFrontmatter(content: string): string | undefined {
  const normalized = (content.charCodeAt(0) === 0xfeff ? content.slice(1) : content).replace(/\r\n?/g, '\n')
  const lines = normalized.split('\n')
  if (lines[0] !== '---') {
    return undefined
  }

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]?.trimEnd()
    if (line === '---' || line === '...') {
      return lines.slice(1, i).join('\n')
    }
  }

  return undefined
}

function hasClosingQuote(content: string, quote: string): boolean {
  let escaped = false
  for (const char of content) {
    if (escaped) {
      escaped = false
      continue
    }
    if (char === '\\') {
      escaped = true
      continue
    }
    if (char === quote) {
      return true
    }
  }
  return false
}

function normalizeQuotedMultilineScalars(source: string): string {
  const lines = source.split('\n')
  const normalized: string[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? ''
    const match = line.match(/^(\s*[^:#][^:]*:\s*)(["'])(.*)$/)
    if (!match) {
      normalized.push(line)
      continue
    }

    const prefix = match[1]!
    const quote = match[2]!
    const rest = match[3]!
    if (hasClosingQuote(rest, quote)) {
      normalized.push(line)
      continue
    }

    let combined = rest.trimEnd()
    let closed = false
    let end = i

    for (let j = i + 1; j < lines.length; j++) {
      const next = (lines[j] ?? '').trim()
      combined += ` ${next}`
      end = j
      if (hasClosingQuote(next, quote)) {
        closed = true
        break
      }
    }

    if (!closed) {
      normalized.push(line)
      continue
    }

    normalized.push(`${prefix}${quote}${combined}`)
    i = end
  }

  return normalized.join('\n')
}

export function parseFrontmatterObject(content: string): Record<string, unknown> {
  const source = extractYamlFrontmatter(content)
  if (source === undefined) {
    return {}
  }

  const document = parseDocument(normalizeQuotedMultilineScalars(source), {
    merge: true,
    strict: false,
  })

  if (document.errors.length > 0) {
    return {}
  }

  const value = document.toJS()
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {}
  }

  return value && typeof value === 'object' && !Array.isArray(value)
    ? value
    : {}
}
