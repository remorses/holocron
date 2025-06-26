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
export function extractNamePathsFromSchema(schema: JSONSchema7, root = ''): string[] {
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
