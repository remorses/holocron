import { DocsConfigSchema } from 'docs-website/src/lib/docs-json'

import { zodToJsonSchema } from 'zod-to-json-schema'

export const loader = async () => {
    const schema = zodToJsonSchema(DocsConfigSchema, 'DocsConfigSchema')
    return new Response(JSON.stringify(schema), {
        headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'public, max-age=3600',
        },
    })
}
