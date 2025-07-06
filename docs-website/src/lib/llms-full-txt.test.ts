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

          /essentials/images

          ━━━

          **Source:** https://docs.fumabase.com/essentials/images#embeds-and-html-elements

          Fumabase supports HTML tags in **<b>Markdown</b>**. This is helpful if you prefer HTML tags to **<b>Markdown</b>** syntax, and lets you create documentation with infinite flexibility.

          ━━━

          **Source:** https://docs.fumabase.com/essentials/images#using-markdown

          Using **<b>Markdown</b>**

          ━━━

          **Source:** https://docs.fumabase.com/essentials/frontmatter

          /essentials/frontmatter

          ━━━

          **Source:** https://docs.fumabase.com/essentials/frontmatter#overview

          Frontmatter is YAML metadata placed at the beginning of your **<b>markdown</b>** files. It controls how your page is displayed and indexed.

          ━━━

          "
        `)
    })
})
