import { describe, test, expect } from 'vitest'
import { searchDocsWithTrieve } from './trieve-search'
import { prisma } from 'db'

describe('searchDocsWithTrieve', () => {
    test('returns empty array when no trieveDatasetId provided', async () => {
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
        const result = await searchDocsWithTrieve({
            query: 'markdown',
            trieveDatasetId: siteBranch?.trieveDatasetId,
        })

        expect(result).toMatchInlineSnapshot(`
          [
            {
              "content": "Images and Embeds",
              "id": "page0fc4904a-dcbb-4d56-9ff2-f10023641c07",
              "type": "page",
              "url": "/essentials/images",
            },
            {
              "content": "src: https://www.youtube.com/embed/4KzFe50RQkQ",
              "id": "/essentials/images-embeds-and-html-elements-content",
              "line": 34,
              "type": "text",
              "url": "/essentials/images#embeds-and-html-elements",
            },
            {
              "content": "Using Markdown",
              "id": "/essentials/images-using-markdown-heading",
              "line": 14,
              "type": "heading",
              "url": "/essentials/images#using-markdown",
            },
            {
              "content": "Writing Accessible Documentation",
              "id": "page2ebacf07-579e-4441-a47d-69d378ce6120",
              "type": "page",
              "url": "/writing/accessibility",
            },
            {
              "content": "Provide text alternatives for multimedia content:",
              "id": "/writing/accessibility-video-and-interactive-content-content",
              "line": 95,
              "type": "text",
              "url": "/writing/accessibility#video-and-interactive-content",
            },
          ]
        `)
    })
})
