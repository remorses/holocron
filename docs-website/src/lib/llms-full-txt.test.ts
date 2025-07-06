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

          **Source:** https://docs.fumabase.com/-website/react-router-docs/elements

          /-website/react-router-docs/elements

          ━━━

          **Source:** https://docs.fumabase.com/-website/react-router-docs/elements#markdown-elements

          **<b>Markdown</b>** Elements

          ━━━

          **Source:** https://docs.fumabase.com/-website/react-router-docs/elements#markdown-elements

          This is for testing all the different kinds of **<b>markdown</b>** that can exist. Whenever I find a styling edge case that exists, I add it to this document. It’s my form of visual regression for all the different kinds of elements that need to be styled across different contexts.

          ━━━

          **Source:** https://docs.fumabase.com/essentials/frontmatter

          /essentials/frontmatter

          ━━━

          **Source:** https://docs.fumabase.com/essentials/frontmatter#overview

          Frontmatter is YAML metadata placed at the beginning of your **<b>markdown</b>** files. It controls how your page is displayed and indexed.

          ━━━

          **Source:** https://docs.fumabase.com/-website/react-router-docs/explanation/special-files

          /-website/react-router-docs/explanation/special-files

          ━━━

          **Source:** https://docs.fumabase.com/-website/react-router-docs/explanation/special-files#entryservertsx

          This file is optional

          ━━━

          **Source:** https://docs.fumabase.com/-website/react-router-docs/upgrading/component-routes

          /-website/react-router-docs/upgrading/component-routes

          ━━━

          **Source:** https://docs.fumabase.com/-website/react-router-docs/upgrading/component-routes#3-add-the-root-entry-point

          In a typical Vite app, the index.html file is the entry point for bundling. The React Router Vite plugin moves the entry point to a root.tsx file so you can use React to render the shell of your app instead of static HTML, and eventually upgrade to Server Rendering if you want.

          ━━━

          **Source:** https://docs.fumabase.com/-website/react-router-docs/community/contributing

          /-website/react-router-docs/community/contributing

          ━━━

          **Source:** https://docs.fumabase.com/-website/react-router-docs/community/contributing#making-a-pull-request

          Pull requests need only the approval of two or more collaborators to be merged; when the PR author is a collaborator, that counts as one.

          ━━━

          "
        `)
    })
})
