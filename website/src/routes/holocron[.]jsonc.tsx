import { DocsConfigSchema } from 'docs-website/src/lib/docs-json'
import { toJSONSchema } from 'zod'

export const loader = async () => {
  // Create schema without poweredBy field for public JSON schema
  const publicSchema = DocsConfigSchema.omit({
    poweredBy: true,
  })
  
  const jsonSchema = toJSONSchema(publicSchema, {})
  
  return new Response(JSON.stringify(jsonSchema, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
