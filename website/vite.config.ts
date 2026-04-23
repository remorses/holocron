import { cloudflare } from '@cloudflare/vite-plugin'
import tailwindcss from '@tailwindcss/vite'
import { holocron } from '@holocron.so/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  server: { port: 7664, strictPort: true },
  clearScreen: false,
  plugins: [
    holocron({ entry: './src/server.tsx' }),
    tailwindcss(),
    cloudflare({
      viteEnvironment: {
        name: 'rsc',
        childEnvironments: ['ssr'],
      },
    }),
  ],
})
