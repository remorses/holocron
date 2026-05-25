/**
 * Prism language registry entrypoint for Holocron client code.
 *
 * Re-exports from the pre-bundled ESM file at `generated/prism-bundle.js`.
 * That file contains prismjs core + all ~300 language grammars in a single
 * module, so Vite's dev optimizer does not discover them one by one.
 *
 * To regenerate after upgrading prismjs:
 *   pnpm -F @holocron.so/vite bundle-prism
 */

export { Prism, prismLanguageIds } from './generated/prism-bundle.js'
