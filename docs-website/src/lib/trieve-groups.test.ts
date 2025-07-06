import { describe, test, expect } from 'vitest'
import { TrieveSDK } from 'trieve-ts-sdk'
import { env } from './env'
import { getAllTrieveGroups } from './trieve-search'

describe('Trieve Groups API', () => {
    test('fetches ALL groups using getAllTrieveGroups function', async () => {
        // Skip test if Trieve credentials are not available
        if (!env.TRIEVE_API_KEY || !env.TRIEVE_ORGANIZATION_ID) {
            console.log('Skipping test: Trieve credentials not configured')
            return
        }

        const testDatasetId = '8edeb160-d7ee-4fda-bc6e-f55eb0ec3554'

        const allGroups = await getAllTrieveGroups({
            trieveDatasetId: testDatasetId,
        })

        // Verify we get an array of groups
        expect(Array.isArray(allGroups)).toBe(true)
        expect(allGroups.length).toBeGreaterThan(0)

        expect(allGroups.map((x) => x.tracking_id).sort())
            .toMatchInlineSnapshot(`
              [
                "/README",
                "/essentials/code",
                "/essentials/images",
                "/essentials/markdown",
                "/essentials/navigation",
                "/writing/accessibility",
                "/writing/code-examples",
                "/writing/content-structure",
                "/writing/user-focused",
                "/writing/visual-design",
                "Code Blocks",
                "Content Structure That Works",
                "Fumabase Starter Kit",
                "Images and Embeds",
                "Markdown Syntax",
                "Navigation",
                "User-Focused Documentation",
                "Visual Design for Documentation",
                "Writing Accessible Documentation",
                "Writing Effective Code Examples",
                "test-group-1751787074037",
                "test-group-1751787361266",
              ]
            `)
    })
})
