import { describe, test, expect } from 'vitest'
import { generateLlmsFullTxt } from './llms-full-txt'

describe('generateLlmsFullTxt', () => {
    test('example domain', async () => {
        const result = await generateLlmsFullTxt({
            domain: 'docs.fumabase.com',
            searchQuery: 'markdown',
        })

        expect(result).toMatchInlineSnapshot(`
          "**Source:** https://docs.fumabase.com/essentials/images

          Images and Embeds

          ━━━

          **Source:** https://docs.fumabase.com/essentials/images#embeds-and-html-elements

          Fumabase supports HTML tags in Markdown. This is helpful if you prefer HTML tags to Markdown syntax, and lets you create documentation with infinite flexibility.

          ━━━

          **Source:** https://docs.fumabase.com/essentials/images#using-markdown

          Using Markdown

          ━━━

          **Source:** https://docs.fumabase.com/essentials/frontmatter

          Frontmatter

          ━━━

          **Source:** https://docs.fumabase.com/essentials/frontmatter#overview

          Frontmatter is YAML metadata placed at the beginning of your markdown files. It controls how your page is displayed and indexed.

          ━━━

          "
        `)
    })
})
