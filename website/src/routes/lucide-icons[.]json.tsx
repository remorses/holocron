import { icons } from '@iconify-json/lucide'

const allLucideIconNames = Object.keys(icons.icons).sort()

export const loader = async () => {
  return new Response(JSON.stringify(allLucideIconNames), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
