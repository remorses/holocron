import { createApiClient, } from './generated/spiceflow-client.js'


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
