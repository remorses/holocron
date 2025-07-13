/**
 * Cleans a slug by removing file extensions (.md, .mdx) and query parameters
 * @param slug - The slug to clean
 * @returns The cleaned slug
 */
 export function cleanSlug(slug: string): string {
     // Remove query parameters and hash fragments first
     const withoutQueryOrHash = slug.split('?')[0].split('#')[0]

     // Remove .md or .mdx extension if present
     if (withoutQueryOrHash.endsWith('.md')) {
         return withoutQueryOrHash.slice(0, -3)
     }
     if (withoutQueryOrHash.endsWith('.mdx')) {
         return withoutQueryOrHash.slice(0, -4)
     }

     return withoutQueryOrHash
 }
