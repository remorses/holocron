import { Route } from './+types/api.icons.$provider.icon.$icon'
import { getIconJsx } from '../lib/icons.server'
import { renderToString } from 'react-dom/server'

export const loader = async ({ params }: Route.LoaderArgs) => {
  let { provider, icon } = params
  // icon = 'archive-restore'
  // Strip ".svg" ending from icon, if present
  const svgExtension = '.svg'
  if (icon.endsWith(svgExtension)) {
    icon = icon.slice(0, - svgExtension.length)
  }
  const iconJsx = getIconJsx({ provider, key: icon })

  if (!iconJsx) {
    const text = `Icon not found: provider="${provider}" icon="${icon}"`
    throw new Response(
      text,
      { status: 404, statusText: `Icon not found: provider="${provider}" icon="${icon}"` },
    )
  }

  const svgString = renderToString(iconJsx)

  return new Response(svgString, {
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control':
        'public, max-age=31536000, immutable, stale-while-revalidate=31536000',
      ETag: `"${provider}-${icon}"`,
      Vary: 'Accept-Encoding',
    },
  })
}
