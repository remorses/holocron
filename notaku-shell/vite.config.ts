import { defineConfig } from 'vite'
import { holocron } from '@holocron.so/vite'

// Minimal docs site used only to produce dist/.holocron with deploy code-splitting.
// Notaku replaces assets/holocron-data.js and assets/holocron-page-*.js per tenant.
export default defineConfig({
  clearScreen: false,
  plugins: [holocron({ pagesDir: './src' })],
})
