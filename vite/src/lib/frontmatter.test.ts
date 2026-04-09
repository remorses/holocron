/**
 * Frontmatter parser tests for Holocron's vendored YAML metadata extraction.
 */

import { describe, expect, test } from 'vitest'
import { parseFrontmatterObject } from './frontmatter.ts'

describe('parseFrontmatterObject', () => {
  test('parses a leading YAML frontmatter block', () => {
    expect(parseFrontmatterObject(`---\ntitle: Hello\ncount: 2\n---\n\n# Body`)).toEqual({
      title: 'Hello',
      count: 2,
    })
  })

  test('ignores content without a leading frontmatter fence', () => {
    expect(parseFrontmatterObject('# Body\n---\ntitle: ignored\n---')).toEqual({})
  })

  test('returns empty object for invalid YAML', () => {
    expect(parseFrontmatterObject(`---\ntitle: [oops\n---\n`)).toEqual({})
  })

  test('joins multiline quoted scalars used by copied docs fixtures', () => {
    expect(parseFrontmatterObject(`---\ndescription: "Get notifications asynchronously when events occur instead of\nhaving to poll for updates"\n---\n`)).toEqual({
      description: 'Get notifications asynchronously when events occur instead of having to poll for updates',
    })
  })
})
