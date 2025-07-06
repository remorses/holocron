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
              "content": "/essentials/images",
              "id": "page0fc4904a-dcbb-4d56-9ff2-f10023641c07",
              "type": "page",
              "url": "/essentials/images",
            },
            {
              "chunk_html": "Fumabase supports HTML tags in <mark><b>Markdown</b></mark>. This is helpful if you prefer HTML tags to <mark><b>Markdown</b></mark> syntax, and lets you create documentation with infinite flexibility.",
              "content": "Fumabase supports HTML tags in <mark><b>Markdown</b></mark>. This is helpful if you prefer HTML tags to <mark><b>Markdown</b></mark> syntax, and lets you create documentation with infinite flexibility.",
              "created_at": "2025-07-04T07:58:01.149377",
              "dataset_id": "706c5b23-ec23-46da-bccf-33b6b90a65b3",
              "id": "/essentials/images-embeds-and-html-elements-content",
              "image_urls": null,
              "link": "/essentials/images",
              "location": null,
              "metadata": {
                "page_id": "/essentials/images",
                "page_title": "Images and Embeds",
                "section": "Embeds and HTML elements",
                "section_id": "embeds-and-html-elements",
              },
              "num_value": null,
              "tag_set": [],
              "time_stamp": null,
              "tracking_id": "/essentials/images-embeds-and-html-elements-content",
              "type": "text",
              "updated_at": "2025-07-04T07:58:01.149377",
              "url": "/essentials/images#embeds-and-html-elements",
              "weight": 0,
            },
            {
              "chunk_html": "Using <mark><b>Markdown</b></mark>",
              "content": "Using <mark><b>Markdown</b></mark>",
              "created_at": "2025-07-04T07:58:01.149380",
              "dataset_id": "706c5b23-ec23-46da-bccf-33b6b90a65b3",
              "id": "/essentials/images-using-markdown-heading",
              "image_urls": null,
              "link": "/essentials/images",
              "location": null,
              "metadata": {
                "page_id": "/essentials/images",
                "page_title": "Images and Embeds",
                "section": "Using Markdown",
                "section_id": "using-markdown",
              },
              "num_value": null,
              "tag_set": [],
              "time_stamp": null,
              "tracking_id": "/essentials/images-using-markdown-heading",
              "type": "text",
              "updated_at": "2025-07-04T07:58:01.149380",
              "url": "/essentials/images#using-markdown",
              "weight": 0,
            },
            {
              "content": "/essentials/frontmatter",
              "id": "page4f85ee7f-5fb0-4bc5-b9e4-cab84c2cc8b3",
              "type": "page",
              "url": "/essentials/frontmatter",
            },
            {
              "chunk_html": "Frontmatter is YAML metadata placed at the beginning of your <mark><b>markdown</b></mark> files. It controls how your page is displayed and indexed.",
              "content": "Frontmatter is YAML metadata placed at the beginning of your <mark><b>markdown</b></mark> files. It controls how your page is displayed and indexed.",
              "created_at": "2025-07-04T07:58:01.149348",
              "dataset_id": "706c5b23-ec23-46da-bccf-33b6b90a65b3",
              "id": "/essentials/frontmatter-overview-content",
              "image_urls": null,
              "link": "/essentials/frontmatter",
              "location": null,
              "metadata": {
                "page_id": "/essentials/frontmatter",
                "page_title": "Frontmatter",
                "section": "Overview",
                "section_id": "overview",
              },
              "num_value": null,
              "tag_set": [],
              "time_stamp": null,
              "tracking_id": "/essentials/frontmatter-overview-content",
              "type": "text",
              "updated_at": "2025-07-04T07:58:01.149348",
              "url": "/essentials/frontmatter#overview",
              "weight": 0,
            },
          ]
        `)
    })
})
