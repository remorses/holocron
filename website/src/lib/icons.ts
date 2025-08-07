import { icons } from '@iconify-json/lucide'

const allLucideIconNames = Object.keys(icons.icons)

export function isValidLucideIconName(iconName: string): boolean {
    return allLucideIconNames.includes(iconName)
}