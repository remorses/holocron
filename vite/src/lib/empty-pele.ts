/**
 * Server-build pele stub. Diagrams render in the browser from the client
 * component effect, so SSR resolves `#pele` here instead of bundling pele.
 */

import type { mountAsync as browserMountAsync } from 'pele/lazy'

export const mountAsync: typeof browserMountAsync = async () => {
  throw new Error('pele diagrams render only in the browser')
}
