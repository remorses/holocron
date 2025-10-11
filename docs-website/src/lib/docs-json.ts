import { extractNamePathsFromSchema } from 'contesto'

export { DocsConfigSchema, type DocsJsonType, docsJsonSchema } from '@holocron.so/cli/src'


import { docsJsonSchema } from '@holocron.so/cli/src'

export const exampleNamePathsForDocsJson = extractNamePathsFromSchema(docsJsonSchema as any)
