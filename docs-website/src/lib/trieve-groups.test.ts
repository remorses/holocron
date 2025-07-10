import { describe, test, expect } from 'vitest'
import { TrieveSDK } from 'trieve-ts-sdk'
import { env } from './env'
import { getAllTrieveGroups } from './trieve-search'
import { prisma } from 'db'

describe('Trieve Groups API', () => {
    test('fetches ALL groups using getAllTrieveGroups function', async () => {
        // Skip test if Trieve credentials are not available
        if (!env.TRIEVE_API_KEY || !env.TRIEVE_ORGANIZATION_ID) {
            console.log('Skipping test: Trieve credentials not configured')
            return
        }

        // Find the dataset for docs.fumabase.com
        const siteBranch = await prisma.siteBranch.findFirst({
            where: {
                domains: {
                    some: {
                        host: 'docs.fumabase.com',
                    },
                },
            },
            select: {
                trieveDatasetId: true,
            },
        })

        if (!siteBranch?.trieveDatasetId) {
            console.log('Skipping test: No dataset found for docs.fumabase.com')
            return
        }

        const testDatasetId = siteBranch.trieveDatasetId

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
                "/essentials/frontmatter",
                "/essentials/images",
                "/essentials/markdown",
                "/sync-architecture",
                "/writing/accessibility",
                "/writing/code-examples",
                "/writing/content-structure",
                "/writing/visual-design",
              ]
            `)
    })
})
