import { describe, test, expect } from 'vitest'
import { generateLlmsFullTxt } from './llms-full-txt'

describe('generateLlmsFullTxt', () => {
    test('example domain', async () => {
        const result = await generateLlmsFullTxt({
            domain: 'docs.fumabase.com',
            searchQuery: 'markdown',
        })

        expect(result).toMatchInlineSnapshot(`
          "**Source:** https://docs.fumabase.com/essentials/images.md

          Images and Embeds

          ━━━

          **Source:** https://docs.fumabase.com/essentials/images.md?startLine=34#embeds-and-html-elements

          src: https://www.youtube.com/embed/4KzFe50RQkQ

          ━━━

          **Source:** https://docs.fumabase.com/essentials/images.md?startLine=14#using-markdown

          Using Markdown

          ━━━

          **Source:** https://docs.fumabase.com/writing/accessibility.md

          Writing Accessible Documentation

          ━━━

          **Source:** https://docs.fumabase.com/writing/accessibility.md?startLine=95#video-and-interactive-content

          Provide text alternatives for multimedia content:

          ━━━

          "
        `)
    })
}, 1000 * 10)
