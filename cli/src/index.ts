import { createApiClient, } from './generated/spiceflow-client.js'
import { DocsJsonType } from 'docs-website/src/lib/docs-json.js'

export { DocsJsonType as HolocronJsonc }


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
