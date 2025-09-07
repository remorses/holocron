import { describe, test, expect } from 'vitest'
import { googleSearch, googleSearchSchema } from './google-search'

describe('googleSearch', () => {
  test('schema validates input correctly', () => {
    const validInput = {
      query: 'test search',
      limit: 5,
    }
    
    const result = googleSearchSchema.parse(validInput)
    expect(result).toMatchInlineSnapshot(`
      {
        "limit": 5,
        "query": "test search",
      }
    `)
  })

  test('schema provides default limit', () => {
    const inputWithoutLimit = {
      query: 'test search',
    }
    
    const result = googleSearchSchema.parse(inputWithoutLimit)
    expect(result).toMatchInlineSnapshot(`
      {
        "limit": 10,
        "query": "test search",
      }
    `)
  })

  test('googleSearchSchema throws on invalid input', () => {
    expect(() => {
      googleSearchSchema.parse({
        query: 123,
        limit: 'not a number',
      })
    }).toThrow()
  })
  
  test('googleSearchSchema throws on missing query', () => {
    expect(() => {
      googleSearchSchema.parse({
        limit: 10,
      })
    }).toThrow()
  })
})