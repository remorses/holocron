import { video } from 'holocron-video/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [video({ entry: './video.mdx' })],
})
