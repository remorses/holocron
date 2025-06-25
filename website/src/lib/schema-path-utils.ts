// website/src/lib/schema-path-utils.ts
// ---------------------------------------------------------------
// 1.  extractPaths()   →  every legal name the LLM can emit
// 2.  applyPath()      →  get or set a value given such a name
// ---------------------------------------------------------------

import type { JSONSchema7 } from 'json-schema'

/* ------------------------------------------------------------------
   extractPaths()
   ------------------------------------------------------------------
   Recursively walks a JSON-Schema draft-07 node and returns every
   possible "form name" respecting:
     • nested objects      →  dot-notation (foo.bar)
     • arrays              →  dot-notation with numeric index (items.0.name)
     • unions (oneOf/anyOf/allOf) →  union of all alternatives
   ------------------------------------------------------------------ */
export function extractPaths(schema: JSONSchema7, root = ''): string[] {
    const paths: string[] = []

    const walk = (node: JSONSchema7, prefix: string) => {
        // unions ────────────────────────────────────────────────────
        const unions = (node.oneOf ?? node.anyOf ?? node.allOf) as
            | JSONSchema7[]
            | undefined
        if (unions && unions.length) {
            unions.forEach((u) => walk(u, prefix))
            return
        }

        // objects ───────────────────────────────────────────────────
        if (node.type === 'object' && node.properties) {
            for (const [key, propSchema] of Object.entries(node.properties)) {
                const next = prefix ? `${prefix}.${key}` : key
                walk(propSchema as JSONSchema7, next)
            }
            return
        }

        // arrays ────────────────────────────────────────────────────
        if (node.type === 'array' && node.items) {
            const next = prefix ? `${prefix}.{index}` : '{index}'
            walk(node.items as JSONSchema7, next)
            return
        }

        // primitives (leaf) ─────────────────────────────────────────
        if (prefix) paths.push(prefix)
    }

    walk(schema, root)
    return paths.filter((p) => p !== '$schema')
}

/* ------------------------------------------------------------------
   applyPath()
   ------------------------------------------------------------------
   Deep-gets or deep-sets an object via a form name.  If `value`
   is provided we *set* the path; otherwise we *get* the current
   value.  Throws on malformed paths or impossible traversals.
   ------------------------------------------------------------------ */
export function applyPath<T = unknown>(
    target: Record<string, any>,
    name: string,
    value?: T,
): T {
    // tokenise:  foo.bar.0.baz  →  ["foo","bar","0","baz"]
    const tokens = name.split('.').filter(Boolean)

    if (!tokens.length) throw new Error('Invalid path')

    let ptr: any = target
    for (let i = 0; i < tokens.length; i++) {
        const key = tokens[i]
        const isNumeric = /^\d+$/.test(key)

        // last token →  set or get
        if (i === tokens.length - 1) {
            if (value !== undefined) {
                if (isNumeric) {
                    if (!Array.isArray(ptr))
                        throw new Error('Path expects array')
                    ptr[Number(key)] = value
                } else {
                    ptr[key] = value
                }
            }
            return isNumeric ? ptr[Number(key)] : ptr[key]
        }

        // walk/create next level
        const nextKey = tokens[i + 1]
        const nextIsNumeric = /^\d+$/.test(nextKey)

        if (isNumeric) {
            if (!Array.isArray(ptr)) throw new Error('Path expects array')
            ptr[Number(key)] ??= nextIsNumeric ? [] : {}
            ptr = ptr[Number(key)]
        } else {
            ptr[key] ??= nextIsNumeric ? [] : {}
            ptr = ptr[key]
        }
    }

    // never reached
    throw new Error('Unknown traversal error')
}
