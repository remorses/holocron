// Fixture-local Vite config that sets pagesDir to ./src so the OpenAPI
// spec (api.yaml inside src/) is resolved via pagesDir probing.
import { defineConfig } from 'vite'
import { holocron } from '@holocron.so/vite/src/vite-plugin.ts'
import {
  cleanupFixtureRunPaths,
  createE2EViteConfig,
  resolveFixtureRunPaths,
} from '../../scripts/e2e-vite-config.ts'

cleanupFixtureRunPaths(resolveFixtureRunPaths())

export default defineConfig(createE2EViteConfig({
  plugins: [holocron({ pagesDir: './src' })],
}))
