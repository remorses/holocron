/**
 * Server-build Mermaid stub. Mermaid rendering happens in the browser from the
 * client component effect, so SSR can resolve `#mermaid` here instead of
 * bundling the multi-megabyte renderer.
 */

export default {
  initialize() {},
  async render() {
    return { svg: '' }
  },
}
