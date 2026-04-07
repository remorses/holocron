export type CodeMetaValue = string | boolean

export function parseCodeMeta(meta: string | null | undefined): Record<string, CodeMetaValue> {
  if (!meta) {
    return {}
  }

  const map: Record<string, CodeMetaValue> = {}
  if (!meta.includes('=')) {
    map.title = meta.trim()
    return map
  }

  const metaRegex = /([\w-]+)(?:=(?:"([^"]*)"|'([^']*)'|([^\s"']+)))?/g
  let match: RegExpExecArray | null

  while ((match = metaRegex.exec(meta)) !== null) {
    const name = match[1]
    if (!name) {
      continue
    }
    const raw = match[2] ?? match[3] ?? match[4]
    if (raw === undefined) {
      map[name] = true
      continue
    }
    if (raw === 'true') {
      map[name] = true
      continue
    }
    if (raw === 'false') {
      map[name] = false
      continue
    }
    map[name] = raw
  }

  return map
}
