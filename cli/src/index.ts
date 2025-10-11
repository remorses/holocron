import { createApiClient, } from './generated/spiceflow-client.js'

export type { DocsJsonType as HolocronJsonc, DocsJsonType } from './docs-json.js'
export { DocsConfigSchema, docsJsonSchema } from './docs-json.js'


export * from './types.js'
export function createHolocronApiClient({ url = 'https://holocron.so', apiKey = process.env.HOLOCRON_API_KEY }) {

  const apiClient = createApiClient(url, {
    onRequest() {
      if (apiKey) {
        return {
          headers: {
            'x-api-key': apiKey,
          },
        }
      }

      return {}
    },
  })

  return apiClient

}
