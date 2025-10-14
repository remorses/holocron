import { describe, test, expect } from 'vitest'
import { generateLlmsFullTxt } from './llms-full-txt'

describe(
  'generateLlmsFullTxt',
  () => {
    test('example domain', async () => {
      const result = await generateLlmsFullTxt({
        domain: 'docs.holocron.so',
        searchQuery: ['markdown'],
      })

      expect(result).toMatchInlineSnapshot(`""`)
    })
  },
  1000 * 10,
)
