import { defineConfig } from 'vite'
import { holocron } from '@holocron.so/vite'
import { visualizer } from 'rollup-plugin-visualizer'

const analyzeBundle = process.env.ANALYZE_BUNDLE === '1'

export default defineConfig({
  clearScreen: false,
  build: analyzeBundle ? { sourcemap: true } : undefined,
  plugins: [
    holocron({ pagesDir: './src' }),
    analyzeBundle
      ? visualizer({
          emitFile: true,
          filename: 'stats.html',
          template: 'treemap',
          gzipSize: true,
          brotliSize: true,
          sourcemap: true,
        })
      : undefined,
  ],
})
