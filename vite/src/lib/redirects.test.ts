/**
 * Redirect tests — exercised through a real Spiceflow app.
 *
 * Each test registers redirect rules as `.get()` routes (same approach
 * as app-factory.tsx), then fires real `Request` objects via `app.handle()`.
 */
import { describe, test, expect } from 'vitest'
import { Spiceflow, redirect } from 'spiceflow'
import { deduplicateRedirects, interpolateDestination } from './redirects.ts'
import type { HolocronConfig } from '../config.ts'

type ConfigRedirect = HolocronConfig['redirects'][number]

/** Build a Spiceflow app with redirect .get() routes + a catch-all
 *  fallback, then fire a request at it. Returns { status, location }. */
async function hit(
  rules: ConfigRedirect[],
  path: string,
): Promise<{ status: number; location: string | null }> {
  let app: any = new Spiceflow()

  for (const rule of deduplicateRedirects(rules)) {
    app = app.get(rule.source, ({ request, params }: { request: Request; params: Record<string, string> }) => {
      const url = new URL(request.url)
      const allParams = { ...params, splat: params['*'] ?? '' }
      let dest = interpolateDestination(rule.destination, allParams)
      if (!dest.includes('?') && url.search) dest += url.search
      throw redirect(dest, { status: rule.permanent ? 301 : 302 })
    })
  }

  app = app.get('/*', () => new Response('OK', { status: 200 }))

  const response = await app.handle(new Request('http://test.local' + path))
  return {
    status: response.status,
    location: response.headers.get('location'),
  }
}

describe('redirects — exact paths', () => {
  test('exact match → 302 by default', async () => {
    expect(await hit([{ source: '/old', destination: '/new' }], '/old'))
      .toMatchInlineSnapshot(`
      {
        "location": "/new",
        "status": 302,
      }
    `)
  })

  test('permanent: true → 301', async () => {
    expect(
      await hit(
        [{ source: '/gone', destination: '/here', permanent: true }],
        '/gone',
      ),
    ).toMatchInlineSnapshot(`
      {
        "location": "/here",
        "status": 301,
      }
    `)
  })

  test('permanent: false explicit → 302', async () => {
    const res = await hit(
      [{ source: '/a', destination: '/b', permanent: false }],
      '/a',
    )
    expect(res.status).toBe(302)
  })

  test('special path chars (dot/dash/underscore) match literally', async () => {
    const rules: ConfigRedirect[] = [
      { source: '/v1.0/api_key-old', destination: '/v1/keys' },
    ]
    expect((await hit(rules, '/v1.0/api_key-old')).location).toBe('/v1/keys')
    expect((await hit(rules, '/v1X0/api_key-old')).status).toBe(200)
  })
})

describe('redirects — named params', () => {
  test(':id capture substituted in destination', async () => {
    expect(
      await hit(
        [{ source: '/users/:id', destination: '/u/:id' }],
        '/users/42',
      ),
    ).toMatchInlineSnapshot(`
      {
        "location": "/u/42",
        "status": 302,
      }
    `)
  })

  test('multi-param path', async () => {
    const res = await hit(
      [{ source: '/r/:owner/:repo', destination: '/repos/:owner/:repo' }],
      '/r/remorses/holocron',
    )
    expect(res.location).toBe('/repos/remorses/holocron')
  })

  test(':id only matches a single segment (not slash-containing)', async () => {
    const res = await hit(
      [{ source: '/users/:id', destination: '/u/:id' }],
      '/users/42/posts',
    )
    expect(res.status).toBe(200)
  })

  test(':param placeholder used twice in destination', async () => {
    const res = await hit(
      [{ source: '/a/:x/b/:y', destination: '/new/:y/:x/:y' }],
      '/a/1/b/2',
    )
    expect(res.location).toBe('/new/2/1/2')
  })
})

describe('redirects — trailing wildcard', () => {
  test(':splat captures remaining path', async () => {
    const rules: ConfigRedirect[] = [
      { source: '/blog/*', destination: '/posts/:splat' },
    ]
    expect((await hit(rules, '/blog/hello-world')).location).toBe(
      '/posts/hello-world',
    )
    expect((await hit(rules, '/blog/2024/launch')).location).toBe(
      '/posts/2024/launch',
    )
  })

  test('mixed :param + * splat', async () => {
    const res = await hit(
      [{ source: '/docs/:section/*', destination: '/d/:section/:splat' }],
      '/docs/api/v1/users',
    )
    expect(res.location).toBe('/d/api/v1/users')
  })
})

describe('redirects — precedence', () => {
  test('exact path beats :param pattern', async () => {
    const rules: ConfigRedirect[] = [
      { source: '/users/:id', destination: '/u/:id' },
      { source: '/users/new', destination: '/signup' },
    ]
    expect((await hit(rules, '/users/new')).location).toBe('/signup')
    expect((await hit(rules, '/users/42')).location).toBe('/u/42')
  })

  test('exact path beats * splat', async () => {
    const rules: ConfigRedirect[] = [
      { source: '/blog/*', destination: '/posts/:splat' },
      { source: '/blog/index', destination: '/home', permanent: true },
    ]
    expect((await hit(rules, '/blog/index')).location).toBe('/home')
    expect((await hit(rules, '/blog/index')).status).toBe(301)
    expect((await hit(rules, '/blog/other')).location).toBe('/posts/other')
  })

  test('duplicate exact rules: first declaration wins', async () => {
    const rules: ConfigRedirect[] = [
      { source: '/a', destination: '/first' },
      { source: '/a', destination: '/second' },
    ]
    expect((await hit(rules, '/a')).location).toBe('/first')
  })
})

describe('redirects — query string preservation', () => {
  test('query string preserved on exact redirect', async () => {
    const res = await hit(
      [{ source: '/old', destination: '/new' }],
      '/old?ref=x&utm=y',
    )
    expect(res.location).toBe('/new?ref=x&utm=y')
  })

  test('query string preserved on :param redirect', async () => {
    const res = await hit(
      [{ source: '/users/:id', destination: '/u/:id' }],
      '/users/42?from=home',
    )
    expect(res.location).toBe('/u/42?from=home')
  })

  test('query string preserved on wildcard redirect', async () => {
    const res = await hit(
      [{ source: '/blog/*', destination: '/posts/:splat' }],
      '/blog/hello?foo=bar',
    )
    expect(res.location).toBe('/posts/hello?foo=bar')
  })

  test('destination with its own query overrides incoming query', async () => {
    const res = await hit(
      [{ source: '/old', destination: '/new?source=legacy' }],
      '/old?ref=x',
    )
    expect(res.location).toBe('/new?source=legacy')
  })
})

describe('redirects — no match / empty rules', () => {
  test('unmatched path falls through to catch-all', async () => {
    const res = await hit([{ source: '/old', destination: '/new' }], '/other')
    expect(res.status).toBe(200)
    expect(res.location).toBeNull()
  })

  test('empty rules: no-op', async () => {
    const res = await hit([], '/anything')
    expect(res.status).toBe(200)
    expect(res.location).toBeNull()
  })
})

/* ── Pure helpers ──────────────────────────────────────────────────── */

describe('interpolateDestination', () => {
  test('substitutes :name with params[name]', () => {
    expect(interpolateDestination('/u/:id', { id: '42' })).toBe('/u/42')
  })

  test('substitutes :splat placeholder', () => {
    expect(interpolateDestination('/posts/:splat', { splat: 'hello/world' })).toBe(
      '/posts/hello/world',
    )
  })

  test('repeated placeholder expands every occurrence', () => {
    expect(interpolateDestination('/:x/:y/:x', { x: 'a', y: 'b' })).toBe('/a/b/a')
  })

  test('unknown placeholder expands to empty string', () => {
    expect(interpolateDestination('/:x/:unknown', { x: 'a' })).toBe('/a/')
  })

  test('template with no placeholders is returned unchanged', () => {
    expect(interpolateDestination('/home', {})).toBe('/home')
  })
})

describe('deduplicateRedirects', () => {
  test('first declaration wins', () => {
    const result = deduplicateRedirects([
      { source: '/a', destination: '/first' },
      { source: '/a', destination: '/second' },
      { source: '/b', destination: '/b2' },
    ])
    expect(result).toHaveLength(2)
    expect(result[0]!.destination).toBe('/first')
    expect(result[1]!.destination).toBe('/b2')
  })
})
