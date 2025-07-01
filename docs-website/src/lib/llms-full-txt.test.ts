import { describe, test, expect } from 'vitest'
import { generateLlmsFullTxt } from './llms-full-txt'

describe('generateLlmsFullTxt', () => {
    test('returns empty string for non-existent domain', async () => {
        const result = await generateLlmsFullTxt({
            domain: 'fumabase-ldg6b0h4.localhost',
            searchQuery: 'markdown',
        })

        expect(result).toMatchInlineSnapshot(`
          "**Source:** https://fumabase-ldg6b0h4.localhost/essentials/images

          Images and Embeds

          ━━━

          **Source:** https://fumabase-ldg6b0h4.localhost/essentials/images#embeds-and-html-elements

          Fumabase supports HTML tags in **Markdown**. This is helpful if you prefer HTML tags to **Markdown** syntax, and lets you create documentation with infinite flexibility.

          ━━━

          **Source:** https://fumabase-ldg6b0h4.localhost/essentials/images#using-markdown

          Using **Markdown**

          ━━━

          **Source:** https://fumabase-ldg6b0h4.localhost/essentials/images

          /essentials/images

          ━━━

          **Source:** https://fumabase-ldg6b0h4.localhost/essentials/images#embeds-and-html-elements

          Fumabase supports HTML tags in **Markdown**. This is helpful if you prefer HTML tags to **Markdown** syntax, and lets you create documentation with infinite flexibility.

          ━━━

          **Source:** https://fumabase-ldg6b0h4.localhost/essentials/images#using-markdown

          Using **Markdown**

          ━━━

          "
        `)
    })
})
