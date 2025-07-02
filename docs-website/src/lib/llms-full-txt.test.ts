import { describe, test, expect } from 'vitest'
import { generateLlmsFullTxt } from './llms-full-txt'

describe('generateLlmsFullTxt', () => {
    test('returns empty string for non-existent domain', async () => {
        const result = await generateLlmsFullTxt({
            domain: 'fumabase-ldg6b0h4.localhost',
            searchQuery: 'markdown',
        })

        expect(result).toMatchInlineSnapshot(`""`)
    })
})
