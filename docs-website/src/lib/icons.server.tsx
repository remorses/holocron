import { icons } from '@iconify-json/lucide'
import { createElement, ReactSVGElement } from 'react'

export function getIconJsx({ key }) {
    if (!key) return null
    const alias = icons.aliases?.[key]?.parent
    const icon = icons[key || alias]
    if (!icon) {
        console.error(`icon with key ${key} not found`)
        return null
    }
    const { width, height } = icons
    const { body } = icon
    return createElement('svg', {
        viewBox: `0 0 ${width} ${height}`,
        xmlns: 'http://www.w3.org/2000/svg',
        dangerouslySetInnerHTML: { __html: body },
    }) as ReactSVGElement
}
