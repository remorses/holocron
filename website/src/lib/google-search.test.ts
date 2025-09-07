import { describe, test, expect } from 'vitest'
import { googleSearch } from './google-search'

describe('googleSearch', () => {
  test('returns search results from Google', async () => {
    const result = await googleSearch({
      query: 'vitest',
      limit: 5,
    })
    
    expect(result).toMatchInlineSnapshot()
  })
})