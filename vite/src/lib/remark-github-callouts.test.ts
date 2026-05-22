/** Tests the GitHub callout quote compatibility transform. */

import { describe, expect, test } from 'vitest'
import { remarkGithubCallouts } from './remark-github-callouts.ts'
import { runRemarkPlugin } from './remark-test-utils.ts'

describe('remarkGithubCallouts', () => {
  test('rewrites GitHub note quotes to Note JSX', () => {
    const result = runRemarkPlugin(`
> [!NOTE]
> Holocron renders **MDX** docs.
`, remarkGithubCallouts)

    expect(result.markdown).toMatchInlineSnapshot(`
      "<Note title=\"Note\">
        Holocron renders **MDX** docs.
      </Note>
      "
    `)
  })

  test('preserves multiple paragraphs and lists inside callouts', () => {
    const result = runRemarkPlugin(`
> [!WARNING]
> First paragraph.
>
> - one
> - two
`, remarkGithubCallouts)

    expect(result.markdown).toMatchInlineSnapshot(`
      "<Warning title=\"Warning\">
        First paragraph.

        * one
        * two
      </Warning>
      "
    `)
  })

  test('keeps normal blockquotes unchanged', () => {
    const result = runRemarkPlugin(`
> Regular quote.
`, remarkGithubCallouts)

    expect(result.markdown).toMatchInlineSnapshot(`
      "> Regular quote.
      "
    `)
  })

  test('supports all GitHub callout labels', () => {
    const result = runRemarkPlugin(`
> [!TIP]
> Tip body.

> [!IMPORTANT]
> Important body.

> [!CAUTION]
> Caution body.
`, remarkGithubCallouts)

    expect(result.markdown).toMatchInlineSnapshot(`
      "<Tip title=\"Tip\">
        Tip body.
      </Tip>

      <Info title=\"Important\">
        Important body.
      </Info>

      <Danger title=\"Caution\">
        Caution body.
      </Danger>
      "
    `)
  })
})
