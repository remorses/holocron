import { test } from 'vitest'
import dedent from 'dedent'
import { describe, expect } from 'vitest'
import { remark } from 'remark'
import { visit } from 'unist-util-visit'
import { Root } from 'mdast'
import { processorMd, processorMdx } from './mdx'

describe('GitHub Blockquotes Plugin', () => {
    test('transforms GitHub-style blockquotes correctly', async () => {
        // Example markdown with GitHub-style blockquotes
        const markdown = dedent`
        # hello

        > [!NOTE]
        > Useful information that users should know, even when skimming content.

        `

        const result = await processorMdx.process(markdown)
        const data = result.data as { ast: Root }

        // Check the full output
        expect(String(result)).toMatchInlineSnapshot(`
          "<Callout type="note">
            Useful information that users should know, even when skimming content.
          </Callout>
          "
        `)
    })

})
