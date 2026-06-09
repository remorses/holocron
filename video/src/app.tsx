/**
 * Spiceflow entry for the video framework.
 * Renders the PlayerPage client component which handles everything:
 * MDX parsing, module resolution, composition creation, and Player rendering.
 */

import { Spiceflow } from 'spiceflow'
import mdxSource from 'virtual:egaki-mdx'
import { PlayerPage } from './player-page'

export const app = new Spiceflow()
  .page('/', async () => {
    return <PlayerPage mdxSource={mdxSource} />
  })
