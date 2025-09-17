
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { env } from './env'

export const moonshot = createOpenAICompatible({
  name: 'moonshot',
  apiKey: env.MOONSHOT_API_KEY,
  baseURL: 'https://api.moonshot.ai/v1',
})
