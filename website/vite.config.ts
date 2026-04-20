import { cloudflare } from '@cloudflare/vite-plugin'
import { holocron } from '@holocron.so/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  clearScreen: false,
  plugins: [
    holocron({ entry: './server.tsx' }),
    cloudflare({
      viteEnvironment: {
        name: 'rsc',
        childEnvironments: ['ssr'],
      },
    }),
  ],
})
