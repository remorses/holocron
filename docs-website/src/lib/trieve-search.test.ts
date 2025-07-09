import { describe, test, expect } from 'vitest'
import { searchDocsWithTrieve } from './trieve-search'




describe('searchDocsWithTrieve', () => {
    test('returns empty array when no trieveDatasetId provided', async () => {
        const result = await searchDocsWithTrieve({
            query: 'markdown',
            trieveDatasetId: '706c5b23-ec23-46da-bccf-33b6b90a65b3',
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
              "content": "### Using Markdown",
              "id": "/essentials/images-using-markdown-heading",
              "line": undefined,
              "type": "heading",
              "url": "/essentials/images#using-markdown",
            },
            {
              "content": "src: https://www.youtube.com/embed/4KzFe50RQkQ",
              "id": "/essentials/images-embeds-and-html-elements-content",
              "line": undefined,
              "type": "text",
              "url": "/essentials/images#embeds-and-html-elements",
            },
            {
              "content": "Writing Accessible Documentation",
              "id": "page2ebacf07-579e-4441-a47d-69d378ce6120",
              "type": "page",
              "url": "/writing/accessibility",
            },
            {
              "content": "Write alt text that conveys the same information the image provides:",
              "id": "/writing/accessibility-effective-alt-text-content",
              "line": undefined,
              "type": "text",
              "url": "/writing/accessibility#effective-alt-text",
            },
            {
              "content": "Use simple, direct language that communicates efficiently:",
              "id": "/writing/accessibility-write-for-clarity-content",
              "line": undefined,
              "type": "text",
              "url": "/writing/accessibility#write-for-clarity",
            },
            {
              "content": "Provide text alternatives for multimedia content:",
              "id": "/writing/accessibility-video-and-interactive-content-content",
              "line": undefined,
              "type": "text",
              "url": "/writing/accessibility#video-and-interactive-content",
            },
            {
              "content": "Use multiple visual cues to communicate status and importance:",
              "id": "/writing/accessibility-color-independent-information-design-content",
              "line": undefined,
              "type": "text",
              "url": "/writing/accessibility#color-independent-information-design",
            },
            {
              "content": "Content Structure That Works",
              "id": "page1c45d46c-a5f0-49a9-b615-780536eb5391",
              "type": "page",
              "url": "/writing/content-structure",
            },
            {
              "content": "Never assume users have the same context you do. Explicitly state what they need to know or have ready.",
              "id": "/writing/content-structure-context-and-prerequisites-content",
              "line": undefined,
              "type": "text",
              "url": "/writing/content-structure#context-and-prerequisites",
            },
          ]
        `)
    })
})
