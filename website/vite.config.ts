import { cloudflare } from '@cloudflare/vite-plugin'
import tailwindcss from '@tailwindcss/vite'
import { holocron } from '@holocron.so/vite'
import { defineConfig } from 'vite'
import { visualizer } from 'rollup-plugin-visualizer'

const analyzeBundle = process.env.ANALYZE_BUNDLE === '1'

export default defineConfig({
  server: { port: 7664, strictPort: true },
  clearScreen: false,
  build: analyzeBundle ? { sourcemap: true } : undefined,
  environments: {
    rsc: {
      optimizeDeps: { include: ['@holocron.so/vite > safe-mdx > linkedom'] },
    },
  },
  plugins: [
    holocron({ entry: './src/server.tsx', pagesDir: 'src/pages' }),
    tailwindcss(),
    cloudflare({
      viteEnvironment: {
        name: 'rsc',
        childEnvironments: ['ssr'],
      },
    }),
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
