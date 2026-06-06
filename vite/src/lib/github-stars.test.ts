import { describe, it, expect } from 'vitest'
import { parseGitHubRepo, formatStarCount } from './github-stars.ts'

describe('parseGitHubRepo', () => {
  it('parses standard repo URL', () => {
    expect(parseGitHubRepo('https://github.com/remorses/holocron')).toMatchInlineSnapshot(`
      {
        "owner": "remorses",
        "repo": "holocron",
      }
    `)
  })

  it('parses URL with trailing path segments', () => {
    expect(parseGitHubRepo('https://github.com/polarsource/polar/tree/main/docs')).toMatchInlineSnapshot(`
      {
        "owner": "polarsource",
        "repo": "polar",
      }
    `)
  })

  it('parses www.github.com', () => {
    expect(parseGitHubRepo('https://www.github.com/owner/repo')).toMatchInlineSnapshot(`
      {
        "owner": "owner",
        "repo": "repo",
      }
    `)
  })

  it('returns null for non-GitHub URLs', () => {
    expect(parseGitHubRepo('https://gitlab.com/owner/repo')).toBeNull()
  })

  it('returns null for GitHub profile URLs (no repo)', () => {
    expect(parseGitHubRepo('https://github.com/remorses')).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(parseGitHubRepo('')).toBeNull()
  })

  it('returns null for invalid URL', () => {
    expect(parseGitHubRepo('not-a-url')).toBeNull()
  })
})

describe('formatStarCount', () => {
  it('formats small numbers as-is', () => {
    expect(formatStarCount(0)).toMatchInlineSnapshot(`"0"`)
    expect(formatStarCount(1)).toMatchInlineSnapshot(`"1"`)
    expect(formatStarCount(999)).toMatchInlineSnapshot(`"999"`)
  })

  it('formats thousands with k suffix', () => {
    expect(formatStarCount(1000)).toMatchInlineSnapshot(`"1k"`)
    expect(formatStarCount(1200)).toMatchInlineSnapshot(`"1.2k"`)
    expect(formatStarCount(1234)).toMatchInlineSnapshot(`"1.2k"`)
    expect(formatStarCount(9999)).toMatchInlineSnapshot(`"10k"`)
  })

  it('formats tens of thousands without decimal', () => {
    expect(formatStarCount(10000)).toMatchInlineSnapshot(`"10k"`)
    expect(formatStarCount(12345)).toMatchInlineSnapshot(`"12k"`)
    expect(formatStarCount(99999)).toMatchInlineSnapshot(`"100k"`)
  })

  it('formats millions', () => {
    expect(formatStarCount(1000000)).toMatchInlineSnapshot(`"1m"`)
    expect(formatStarCount(1500000)).toMatchInlineSnapshot(`"1.5m"`)
  })
})
