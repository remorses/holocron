import { Route } from './+types/api.icons.$provider.icon.$icon[.]svg'
import { getIconJsx } from '../lib/icons.server'
import { renderToString } from 'react-dom/server'

export const loader = async ({ params }: Route.LoaderArgs) => {
  let { provider, icon } = params
  // icon = 'archive-restore'
  const iconJsx = getIconJsx({ provider, key: icon })

  if (!iconJsx) {
    throw new Response(`Icon not found: provider="${provider}" icon="${icon}"`, { status: 404 })
  }

  const svgString = renderToString(iconJsx)

  return new Response(svgString, {
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  })
}
