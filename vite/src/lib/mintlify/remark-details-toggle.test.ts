/** Tests the details/summary compatibility transform for Expandable MDX. */

import { describe, expect, test } from 'vitest'
import { runRemarkPlugin } from './remark-test-utils.ts'
import { remarkDetailsToggle } from './remark-details-toggle.ts'

describe('remarkDetailsToggle', () => {
  test('rewrites html details and summary to Expandable', () => {
    const result = runRemarkPlugin(`
<details>
<summary>What is Holocron?</summary>

Holocron renders **MDX** docs.
</details>
`, remarkDetailsToggle)

    expect(result.markdown).toMatchInlineSnapshot(`
      "<Expandable title={<Markdown children=\"What is Holocron?\" />}>
        Holocron renders **MDX** docs.
      </Expandable>
      "
    `)
  })

  test('preserves open state as defaultOpen', () => {
    const result = runRemarkPlugin(`
<details open>
<summary>Advanced</summary>

Content.
</details>
`, remarkDetailsToggle)

    expect(result.markdown).toMatchInlineSnapshot(`
      "<Expandable title={<Markdown children=\"Advanced\" />} defaultOpen>
        Content.
      </Expandable>
      "
    `)
  })

  test('handles multi-line summaries', () => {
    const result = runRemarkPlugin(`
<details>
<summary>
Use **rich** labels
</summary>

Content.
</details>
`, remarkDetailsToggle)

    expect(result.markdown).toMatchInlineSnapshot(`
      "<Expandable title={<Markdown children=\"Use **rich** labels\" />}>
        Content.
      </Expandable>
      "
    `)
  })

  test('preserves code blocks and tables inside details body', () => {
    const result = runRemarkPlugin(`
<details>
<summary>Examples</summary>

| Name | Value |
| ---- | ----- |
| foo  | bar   |

\`\`\`ts
const value = 'ok'
\`\`\`
</details>
`, remarkDetailsToggle)

    expect(result.markdown).toMatchInlineSnapshot(`
      "<Expandable title={<Markdown children=\"Examples\" />}>
        \\| Name | Value |
        \\| ---- | ----- |
        \\| foo  | bar   |

        \`\`\`ts
        const value = 'ok'
        \`\`\`
      </Expandable>
      "
    `)
  })
})
