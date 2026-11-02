import { defineConfig } from 'vite'
import { cloudflare } from '@cloudflare/vite-plugin'
import { holocron } from '@holocron.so/vite/vite'
import {
  cleanupFixtureRunPaths,
  createE2EViteConfig,
  resolveFixtureRunPaths,
} from '../../scripts/e2e-vite-config.ts'

cleanupFixtureRunPaths(resolveFixtureRunPaths())

export default defineConfig(createE2EViteConfig({
  plugins: [
    holocron({ entry: './server.tsx' }),
    !process.env.E2E_START && cloudflare({
      viteEnvironment: {
        name: 'rsc',
        childEnvironments: ['ssr'],
      },
    }),
  ],
}))
