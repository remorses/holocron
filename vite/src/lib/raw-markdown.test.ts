/**
 * Tests for stripVisibilityForAgents — the MDX transform that
 * removes human-only content and unwraps agent-only content
 * before serving .md files to AI agents.
 */

import { describe, expect, test } from 'vitest'
import { stripVisibilityForAgents } from './raw-markdown.ts'

describe('stripVisibilityForAgents', () => {
  test('strips <Visibility for="humans"> blocks entirely', () => {
    const input = `# Hello

<Visibility for="humans">
Click the **Get started** button in the top-right corner.
</Visibility>

Some other content.`

    expect(stripVisibilityForAgents(input)).toMatchInlineSnapshot(`
      "# Hello

      Some other content.
      "
    `)
  })

  test('unwraps <Visibility for="agents"> keeping inner content', () => {
    const input = `# Hello

<Visibility for="agents">
To create an account, call \`POST /v1/accounts\`.
</Visibility>

Some other content.`

    expect(stripVisibilityForAgents(input)).toMatchInlineSnapshot(`
      "# Hello

      To create an account, call \`POST /v1/accounts\`.

      Some other content.
      "
    `)
  })

  test('strips <Visibility> with no for prop (treated as humans)', () => {
    const input = `# Hello

<Visibility>
This is human-only content.
</Visibility>

Rest of page.`

    expect(stripVisibilityForAgents(input)).toMatchInlineSnapshot(`
      "# Hello

      Rest of page.
      "
    `)
  })

  test('handles both humans and agents blocks in same document', () => {
    const input = `# API Guide

<Visibility for="humans">
Click the dashboard button to see your keys.
</Visibility>

<Visibility for="agents">
Call \`GET /v1/keys\` to list your API keys.
</Visibility>

## Authentication`

    expect(stripVisibilityForAgents(input)).toMatchInlineSnapshot(`
      "# API Guide

      Call \`GET /v1/keys\` to list your API keys.

      ## Authentication
      "
    `)
  })

  test('handles single quotes in for attribute', () => {
    const input = `<Visibility for='agents'>
Agent content here.
</Visibility>`

    expect(stripVisibilityForAgents(input)).toMatchInlineSnapshot(`
      "Agent content here.
      "
    `)
  })

  test('passes through content without Visibility unchanged', () => {
    const input = '# Just a normal page\n\nSome content.'
    expect(stripVisibilityForAgents(input)).toBe(input)
  })

  test('handles multiline nested MDX inside Visibility', () => {
    const input = `<Visibility for="agents">
> **Note:** Use the API endpoint below.

\`\`\`bash
curl -X POST https://api.example.com/v1/accounts
\`\`\`
</Visibility>`

    expect(stripVisibilityForAgents(input)).toMatchInlineSnapshot(`
      "> **Note:** Use the API endpoint below.

      \`\`\`bash
      curl -X POST https://api.example.com/v1/accounts
      \`\`\`
      "
    `)
  })
})
