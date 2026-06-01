import { afterEach, describe, expect, test, vi } from 'vitest'
import type { ConfigNavTab } from '../../config.ts'
import { processMdx } from '../mdx-processor.ts'
import { changelogProvider } from './provider.ts'

/** The raw GitHub release JSON shape used by the test fixtures. */
type RawRelease = {
  tag_name: string
  name: string | null
  body: string | null
  published_at: string | null
  html_url: string
  draft: boolean
  prerelease: boolean
}

/** Stub global fetch to return the given releases on page 1, empty after.
 *  Each test uses a unique repo so the provider's in-memory release cache
 *  does not bleed across cases. */
function stubReleases(releases: RawRelease[]): void {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const page = Number(new URL(String(input)).searchParams.get('page') ?? '1')
    const body = page === 1 ? releases : []
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  })
}

const ctx = { projectRoot: '/tmp', pagesDir: '/tmp' }

describe('changelogProvider', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('claims a tab with a changelog field', () => {
    const withChangelog: ConfigNavTab = { tab: 'Changelog', groups: [], changelog: 'x' }
    const withoutChangelog: ConfigNavTab = { tab: 'Docs', groups: [] }
    expect(changelogProvider.claims(withChangelog)).toBe(true)
    expect(changelogProvider.claims(withoutChangelog)).toBe(false)
  })

  test('generates one Update per release with a center mode + aside notice', async () => {
    stubReleases([
      {
        tag_name: 'v2.0.0',
        name: 'Version 2',
        body: '## Features\n\n- New thing',
        published_at: '2026-01-05T00:00:00Z',
        html_url: 'https://github.com/acme/widgets/releases/tag/v2.0.0',
        draft: false,
        prerelease: false,
      },
      {
        tag_name: 'v1.0.0',
        name: null,
        body: 'Initial release',
        published_at: '2025-12-01T00:00:00Z',
        html_url: 'https://github.com/acme/widgets/releases/tag/v1.0.0',
        draft: false,
        prerelease: true,
      },
    ])

    const tab: ConfigNavTab = {
      tab: 'Changelog',
      groups: [],
      changelog: 'https://github.com/acme/widgets',
    }
    const result = await changelogProvider.generate({ tab, ...ctx })

    expect(result.groups).toMatchInlineSnapshot(`
      [
        {
          "group": "",
          "pages": [
            "changelog",
          ],
        },
      ]
    `)
    expect(result.mdxContent.changelog).toMatchInlineSnapshot(`
      "---
      title: "Changelog"
      description: "Release notes for Changelog."
      mode: "center"
      ---

      <Aside full>

      <Note>

      This changelog is generated automatically from the [GitHub releases](https://github.com/acme/widgets/releases) page.

      </Note>

      </Aside>

      <Update id={"v2.0.0"} label={"Jan 5, 2026"}>

      ## Version 2

      ## Features

      - New thing

      </Update>

      <Update id={"v1.0.0"} label={"Dec 1, 2025"}>

      ## v1.0.0

      Initial release

      </Update>"
    `)
  })

  test('excludes drafts and uses base for the slug', async () => {
    stubReleases([
      { tag_name: 'v3', name: 'Three', body: 'x', published_at: '2026-02-01T00:00:00Z', html_url: 'h', draft: true, prerelease: false },
      { tag_name: 'v2', name: 'Two', body: 'y', published_at: '2026-01-01T00:00:00Z', html_url: 'h', draft: false, prerelease: false },
    ])

    const tab: ConfigNavTab = {
      tab: 'Releases',
      groups: [],
      changelog: 'https://github.com/acme/drafts',
      base: 'releases',
    }
    const result = await changelogProvider.generate({ tab, ...ctx })
    expect(Object.keys(result.mdxContent)).toEqual(['releases'])
    // The version is the anchor id; the date is the pill label.
    expect(result.mdxContent.releases).toContain('id={"v2"}')
    expect(result.mdxContent.releases).not.toContain('"v3"')
  })

  test('renders a warning page when the fetch fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('nope', { status: 500 }))
    const tab: ConfigNavTab = {
      tab: 'Changelog',
      groups: [],
      changelog: 'https://github.com/acme/down',
    }
    const result = await changelogProvider.generate({ tab, ...ctx })
    expect(result.mdxContent.changelog).toContain('<Warning>')
    expect(result.mdxContent.changelog).toContain('mode: "center"')
  })

  test('release tags/names/bodies with MDX-breaking chars still produce parseable MDX', async () => {
    stubReleases([
      {
        tag_name: 'v1" broken',
        name: 'Use {value} and <Thing>',
        body: [
          'Literal {value} and <Thing> in release notes.',
          '',
          'A fake close: </Update><Danger>oops</Danger>',
          '',
          'Inline `code with {braces} and <tags>` stays literal.',
          '',
          '```ts',
          'const x = <T>() => ({ a: 1 })',
          '```',
        ].join('\n'),
        published_at: '2026-03-01T00:00:00Z',
        html_url: 'https://github.com/acme/evil/releases/tag/v1',
        draft: false,
        prerelease: false,
      },
    ])

    const tab: ConfigNavTab = { tab: 'Changelog', groups: [], changelog: 'https://github.com/acme/evil' }
    const result = await changelogProvider.generate({ tab, ...ctx })
    const mdx = result.mdxContent.changelog!

    // The generated MDX must parse without errors (no injection / breakage).
    const processed = processMdx(mdx, 'fontawesome', '/changelog')
    expect(processed).not.toBeInstanceOf(Error)

    // The fake closing tag must be escaped, not a real <Update> close.
    expect(mdx).not.toContain('</Update><Danger>')
    // Code fence content is preserved verbatim (not escaped).
    expect(mdx).toContain('const x = <T>() => ({ a: 1 })')
  })
})
