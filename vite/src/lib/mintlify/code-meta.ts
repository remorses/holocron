export type CodeMetaValue = string | boolean | null

export type ParsedCodeMeta = {
  title?: string
  attributes: Record<string, CodeMetaValue>
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
    if (!char || /\s/.test(char) || char === '=') {
      break
    }
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
      return { raw: input.slice(index, cursor + 1), value, nextIndex: cursor + 1 }
    }
    value += char
    cursor += 1
  }
  return { raw: input.slice(index), value, nextIndex: input.length }
}

function readBraced(input: string, index: number) {
  let cursor = index + 1
  let depth = 1
  let value = ''
  while (cursor < input.length) {
    const char = input[cursor]
    if (!char) break
    if (char === '{') {
      depth += 1
      value += char
      cursor += 1
      continue
    }
    if (char === '}') {
      depth -= 1
      if (depth === 0) {
        return { raw: input.slice(index, cursor + 1), value: value.trim(), nextIndex: cursor + 1 }
      }
      value += char
      cursor += 1
      continue
    }
    value += char
    cursor += 1
  }
  return { raw: input.slice(index), value: value.trim(), nextIndex: input.length }
}

function parseExpression(raw: string): CodeMetaValue {
  if (raw === 'true') return true
  if (raw === 'false') return false
  if (raw === 'null') return null
  if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) {
    return raw.slice(1, -1)
  }
  return raw
}

function readValue(input: string, index: number) {
  const char = input[index]
  if (!char) {
    return { value: true as CodeMetaValue, nextIndex: index }
  }
  if (char === '"' || char === "'") {
    const quoted = readQuoted(input, index, char)
    return { value: quoted.value, nextIndex: quoted.nextIndex }
  }
  if (char === '{') {
    const braced = readBraced(input, index)
    return { value: parseExpression(braced.value), nextIndex: braced.nextIndex }
  }

  const token = readUntilWhitespaceOrEquals(input, index)
  return { value: parseExpression(token.value), nextIndex: token.nextIndex }
}

export function parseCodeMeta(meta: string | null | undefined): ParsedCodeMeta {
  if (!meta) {
    return { attributes: {} }
  }

  const attributes: Record<string, CodeMetaValue> = {}
  const titleTokens: string[] = []
  let cursor = 0

  while (cursor < meta.length) {
    cursor = skipWhitespace(meta, cursor)
    if (cursor >= meta.length) break

    const token = readUntilWhitespaceOrEquals(meta, cursor)
    if (!token.value) {
      cursor += 1
      continue
    }
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

    if (titleTokens.length === 0) {
      titleTokens.push(token.value)
      continue
    }

    attributes[token.value] = true
  }

  return {
    title: titleTokens.length > 0 ? titleTokens.join(' ') : undefined,
    attributes,
  }
}
