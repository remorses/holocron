/**
 * Minimal spiceflow app to test the standalone ChatWidget from @holocron.so/vite/chat.
 * No holocron plugin needed — this is a plain consumer of the chat widget.
 */

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import spiceflow from 'spiceflow/vite'

export default defineConfig({
  clearScreen: false,
  plugins: [spiceflow({ entry: './src/main.tsx' }), react()],
})
