import { customsearch_v1 } from '@googleapis/customsearch'
import z from 'zod'
import { env } from 'docs-website/src/lib/env'

export const googleSearchSchema = z.object({
  query: z.string().describe('The search query to search the web for'),
  limit: z.number().optional().default(10).describe('Maximum number of search results to return'),
})

export type GoogleSearchInput = z.infer<typeof googleSearchSchema>

export interface GoogleSearchResult {
  title: string
  link: string
  snippet: string
  displayLink: string
}

export interface CleanGoogleSearchResponse {
  items: GoogleSearchResult[]
  totalResults: string
}

export async function googleSearch({ query, limit }: GoogleSearchInput): Promise<CleanGoogleSearchResponse> {
  console.log({ query, limit })
  const customsearch = new customsearch_v1.Customsearch({
    auth: env.GOOGLE_SEARCH_API_KEY,
  })

  const res = await customsearch.cse.list({
    // get this id at https://programmablesearchengine.google.com/controlpanel/overview?cx=c47c2b14ae81745dc
    cx: 'c47c2b14ae81745dc',
    auth: env.GOOGLE_SEARCH_API_KEY,
    q: query,
    num: limit || 10,
    safe: 'off'

  })

  if (!res.data) {
    throw new Error('No data returned from Google Custom Search API')
  }

  const cleanedItems: GoogleSearchResult[] = (res.data.items || []).map(item => ({
    title: item.title || '',
    link: item.link || '',
    snippet: item.snippet || '',
    displayLink: item.displayLink || '',
  }))

  return {
    items: cleanedItems,
    totalResults: res.data.searchInformation?.totalResults || '0',
  }
}
