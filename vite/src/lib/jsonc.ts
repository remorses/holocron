/**
 * JSONC parser — parse JSON with comments and trailing commas.
 *
 * Approach from tiny-jsonc: regex captures strings as group $1 and matches
 * comments as non-captured groups. The replace keeps only $1 (strings),
 * effectively stripping comments while preserving string contents like URLs.
 *
 * Fast path: tries JSON.parse first (no regex overhead for valid JSON).
 * Slow path: strips comments + trailing commas, then parses.
 */

// Matches: "strings" (captured $1) | // single-line comments | /* multi-line */
const stringOrCommentRe = /("(?:\\?[^])*?")|(\/\/.*)|(\/\*[^]*?\*\/)/g

// Matches: "strings" (captured $1) | trailing commas before ] or }
const stringOrTrailingCommaRe = /("(?:\\?[^])*?")|(,\s*)(?=]|})/g

export function parseJsonc(text: string): unknown {
  text = String(text)
  try {
    return JSON.parse(text)
  } catch {
    return JSON.parse(
      text
        .replace(stringOrCommentRe, '$1')
        .replace(stringOrTrailingCommaRe, '$1'),
    )
  }
}
