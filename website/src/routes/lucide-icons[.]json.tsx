
import * as lucideIcons from 'lucide-react'

const allLucideIconNames = Object.keys(lucideIcons)
    .filter(key => {
        // Filter out non-icon exports like createLucideIcon, default export, etc
        return key !== 'default' && 
               key !== 'createLucideIcon' && 
               key !== 'icons' &&
               typeof lucideIcons[key as keyof typeof lucideIcons] === 'function' &&
               // Icon components start with uppercase letter
               /^[A-Z]/.test(key)
    })
    .sort()

export const loader = async () => {
    return new Response(JSON.stringify(allLucideIconNames, null, 2), {
        headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'public, max-age=3600',
        },
    })
}
