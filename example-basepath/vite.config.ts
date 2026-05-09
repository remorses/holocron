import { defineConfig } from 'vite'
import { holocron } from '@holocron.so/vite'

export default defineConfig({
  clearScreen: false,
  base: '/docs',
  plugins: [holocron({ pagesDir: './src' })],
})
