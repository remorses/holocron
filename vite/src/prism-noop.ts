/**
 * Server-build Prism stub. Syntax highlighting happens client-only via the
 * real prism.ts loaded by the `#prism` browser condition. SSR renders
 * unhighlighted code; the client adds highlighting during hydration.
 *
 * This avoids bundling prismjs (~500KB) in the SSR build and sidesteps the
 * CJS global issue that crashes Dynamic Workers (see MEMORY.md
 * "Code splitting breaks prismjs in Dynamic Workers").
 */

export const Prism = {
  languages: {} as Record<string, any>,
  highlight(text: string, _grammar: any, _language: string) {
    return text
  },
}

export const prismLanguageIds: string[] = []
