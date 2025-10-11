import { extractNamePathsFromSchema } from 'contesto'

export { DocsConfigSchema, type DocsJsonType, docsJsonSchema } from '@holocron.so/cli/src/docs-json.js'
export { docsJsonSchema as docsJsonSchemaOriginal } from '@holocron.so/cli/src/docs-json.js'

const { docsJsonSchema } = await import('@holocron.so/cli/src/docs-json.js')

export const exampleNamePathsForDocsJson = extractNamePathsFromSchema(docsJsonSchema as any)
