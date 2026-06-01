import { describe, expect, test } from 'vitest'
import { parseChangelogSource } from './parse-source.ts'

describe('parseChangelogSource', () => {
  test('parses a plain github repo url', () => {
    expect(parseChangelogSource('https://github.com/remorses/holocron')).toMatchInlineSnapshot(`
      {
        "owner": "remorses",
        "platform": "github",
        "releasesUrl": "https://github.com/remorses/holocron/releases",
        "repo": "holocron",
      }
    `)
  })

  test('ignores trailing /releases and extra segments', () => {
    expect(parseChangelogSource('https://github.com/remorses/holocron/releases').repo).toBe('holocron')
    expect(parseChangelogSource('https://github.com/remorses/holocron/tree/main').owner).toBe('remorses')
  })

  test('strips a .git suffix', () => {
    expect(parseChangelogSource('https://github.com/remorses/holocron.git').repo).toBe('holocron')
  })

  test('strips a www. prefix', () => {
    expect(parseChangelogSource('https://www.github.com/remorses/holocron').platform).toBe('github')
  })

  test('throws on a non-github host', () => {
    expect(() => parseChangelogSource('https://gitlab.com/owner/repo')).toThrow(/not supported/)
  })

  test('throws on a malformed url', () => {
    expect(() => parseChangelogSource('not a url')).toThrow(/not a valid URL/)
  })

  test('throws when owner or repo is missing', () => {
    expect(() => parseChangelogSource('https://github.com/owneronly')).toThrow(/owner and repository/)
  })
})
