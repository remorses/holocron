import {
    DocsConfigSchema,
    docsJsonSchema,
} from 'docs-website/src/lib/docs-json'

export const loader = async () => {
    return new Response(JSON.stringify(docsJsonSchema, null, 2), {
        headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'public, max-age=3600',
        },
    })
}
