import { icons as lucideIcons } from '@iconify-json/lucide'
import { createElement, ReactSVGElement } from 'react'

export function getIconJsx({ provider = 'lucide', key }) {
  if (provider !== 'lucide') {
    console.error(
      `Provider "${provider}" is not supported. Only 'lucide' is supported at this time.`,
    )
    return null
  }
  if (!key) return null
  const alias = lucideIcons.aliases?.[key]?.parent
  const icon = lucideIcons.icons[key || alias]
  if (!icon) {
    console.error(`icon with key ${key} not found`)
    return null
  }
  const { width, height } = lucideIcons
  const { body } = icon
  return createElement('svg', {
    viewBox: `0 0 ${width} ${height}`,
    xmlns: 'http://www.w3.org/2000/svg',
    dangerouslySetInnerHTML: { __html: body },
  }) as ReactSVGElement
}
