import { customsearch_v1 } from '@googleapis/customsearch'
import z from 'zod'
import { env } from 'docs-website/src/lib/env'

export const googleSearchSchema = z.object({
  query: z.string().describe('The search query to search the web for'),
  limit: z.number().optional().default(10).describe('Maximum number of search results to return'),
})

export type GoogleSearchInput = z.infer<typeof googleSearchSchema>

export async function googleSearch({ query, limit }: GoogleSearchInput): Promise<customsearch_v1.Schema$Search> {
  console.log({ query, limit })
  const customsearch = new customsearch_v1.Customsearch({
    auth: env.GOOGLE_SEARCH_API_KEY,
  })

  const res = await customsearch.cse.list({
    cx: 'e6c89c83c1eec4ab2',
    q: query,
    num: limit || 10,
  })

  if (!res.data) {
    throw new Error('No data returned from Google Custom Search API')
  }

  return res.data
}