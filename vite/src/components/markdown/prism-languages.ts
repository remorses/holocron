/**
 * Registers every Prism language component so code fences can highlight any
 * grammar Prism ships without needing per-language Holocron updates.
 *
 * loadLanguages() with no args loads all languages in dependency order.
 * It uses CJS require() internally — Vite's dep optimizer handles the
 * CJS-to-ESM conversion.
 */

import prismComponents from 'prismjs/components.json' with { type: 'json' }
import 'prismjs'
import loadLanguages from 'prismjs/components/index.js'

loadLanguages()

export const prismLanguageIds = Object.keys(prismComponents.languages).filter((id) => id !== 'meta')

export {}
