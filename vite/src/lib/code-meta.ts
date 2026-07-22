/**
 * Code fence meta-string parser.
 *
 * Parses the text after the language identifier in a fenced code block:
 *   ```js title.ts bleed lines key="value" expr={false}
 *
 * All values are returned as strings. Braces are unwrapped: `{false}` → "false".
 * Bare words (no `=`) accumulate into a multi-word title (Mintlify convention),
 * except the exact tokens `wrap` and `lines` which are Mintlify boolean flags.
 * Other boolean flags use key=value syntax: `bleed=true`, `lines=false`.
 *
 * Use `metaBool()` at the consumer level to interpret string values as booleans.
 */

export type ParsedCodeMeta = {
  title?: string
  attributes: Record<string, string>
}

/**
 * Interpret a meta attribute value as a boolean.
 * "true" → true, "false" → false, anything else → undefined.
 */
export function metaBool(value: string | undefined): boolean | undefined {
  if (value === 'true') return true
  if (value === 'false') return false
  return undefined
}

/**
 * Bleed controls how far a code block extends past its content column.
 *
 * - `'both'` / `true`: bleed into both left and right margins.
 * - `'right'`: bleed into the right margin only, so the code text after line
 *   numbers lines up with the prose left edge. This is the default the MDX
 *   renderer passes for fenced code blocks.
 * - `'none'` / `false`: no bleed, the block stays fully inside its parent.
 *   This is the component default, useful when rendering <CodeBlock> outside
 *   the docs layout (dashboard, modal, card).
 */
export type BleedMode = 'both' | 'right' | 'none'

/**
 * Map a `bleed` prop (boolean or enum) to the CSS class that applies the
 * corresponding negative margins. `false` / `'none'` returns an empty string
 * so no bleed class is added.
 */
export function bleedClass(bleed: boolean | BleedMode | undefined): '' | 'bleed' | 'bleed-right' {
  if (bleed === true || bleed === 'both') return 'bleed'
  if (bleed === 'right') return 'bleed-right'
  // false, 'none', or undefined → no bleed.
  return ''
}

/** Whether the given bleed value extends into the left margin. */
export function hasLeftBleed(bleed: boolean | BleedMode | undefined): boolean {
  return bleed === true || bleed === 'both'
}

function skipWhitespace(input: string, index: number) {
  let cursor = index
  while (cursor < input.length && /\s/.test(input[cursor] ?? '')) {
    cursor += 1
  }
  return cursor
}

function readUntilWhitespaceOrEquals(input: string, index: number) {
  let cursor = index
  while (cursor < input.length) {
    const char = input[cursor]
    if (!char || /\s/.test(char) || char === '=') break
    cursor += 1
  }
  return { value: input.slice(index, cursor), nextIndex: cursor }
}

function readQuoted(input: string, index: number, quote: '"' | "'") {
  let cursor = index + 1
  let value = ''
  while (cursor < input.length) {
    const char = input[cursor]
    if (!char) break
    if (char === '\\') {
      value += input[cursor + 1] ?? ''
      cursor += 2
      continue
    }
    if (char === quote) {
      return { value, nextIndex: cursor + 1 }
    }
    value += char
    cursor += 1
  }
  return { value, nextIndex: input.length }
}

function readBraced(input: string, index: number) {
  let cursor = index + 1
  let depth = 1
  let value = ''
  while (cursor < input.length) {
    const char = input[cursor]
    if (!char) break
    if (char === '{') { depth += 1; value += char; cursor += 1; continue }
    if (char === '}') {
      depth -= 1
      if (depth === 0) return { value: value.trim(), nextIndex: cursor + 1 }
      value += char; cursor += 1; continue
    }
    value += char
    cursor += 1
  }
  return { value: value.trim(), nextIndex: input.length }
}

/** Strip outer quotes from a string value: `"hello"` → `hello`, `'world'` → `world`. */
function unquote(raw: string): string {
  if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) {
    return raw.slice(1, -1)
  }
  return raw
}

function readValue(input: string, index: number) {
  const char = input[index]
  if (!char) return { value: 'true', nextIndex: index }
  if (char === '"' || char === "'") {
    const quoted = readQuoted(input, index, char)
    return { value: quoted.value, nextIndex: quoted.nextIndex }
  }
  if (char === '{') {
    const braced = readBraced(input, index)
    return { value: unquote(braced.value), nextIndex: braced.nextIndex }
  }
  const token = readUntilWhitespaceOrEquals(input, index)
  return { value: token.value, nextIndex: token.nextIndex }
}

export function parseCodeMeta(meta: string | null | undefined): ParsedCodeMeta {
  if (!meta) return { attributes: {} }

  const attributes: Record<string, string> = {}
  const titleParts: string[] = []
  let cursor = 0

  while (cursor < meta.length) {
    cursor = skipWhitespace(meta, cursor)
    if (cursor >= meta.length) break

    const token = readUntilWhitespaceOrEquals(meta, cursor)
    if (!token.value) { cursor += 1; continue }
    cursor = token.nextIndex
    cursor = skipWhitespace(meta, cursor)

    if (meta[cursor] === '=') {
      cursor += 1
      cursor = skipWhitespace(meta, cursor)
      const parsedValue = readValue(meta, cursor)
      attributes[token.value] = parsedValue.value
      cursor = parsedValue.nextIndex
      continue
    }

    // Mintlify-compatible bare boolean flags: ```text My title wrap
    // The exact lowercase tokens `wrap` and `lines` are flags, not title words.
    if (token.value === 'wrap' || token.value === 'lines') {
      attributes[token.value] = 'true'
      continue
    }

    // All other bare words (no `=`) are accumulated into the title.
    // Boolean flags can also use key=value syntax: `bleed=true`, `lines=false`.
    titleParts.push(token.value)
  }

  let title = titleParts.length > 0 ? titleParts.join(' ') : undefined

  // Explicit title="..." attribute takes priority over bare-word title.
  if (typeof attributes.title === 'string') {
    title = attributes.title
    delete attributes.title
  }

  return { title, attributes }
}
