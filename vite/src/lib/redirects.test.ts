/**
 * Redirect tests — exercised through a real Spiceflow app.
 *
 * Each test builds a bare Spiceflow instance, installs the redirect
 * middleware via `registerRedirects()`, adds a catch-all fallback
 * `.get('/*')` that returns 200, then fires real `Request` objects
 * via `app.handle()`. This is a true integration test of what the
 * holocron runtime actually does.
 *
 * Bare `.get()` + `.use()` work fine together in tests because there
 * are no `.page()` routes that would force spiceflow into its RSC
 * pipeline (where `.get()` routes get ignored — see MEMORY.md).
 */
import { describe, test, expect } from 'vitest'
import { Spiceflow } from 'spiceflow'
import {
  registerRedirects,
  buildRedirectTable,
  matchRedirect,
  interpolateDestination,
  isExactSource,
} from './redirects.ts'
import type { HolocronConfig } from '../config.ts'

type ConfigRedirect = HolocronConfig['redirects'][number]

/** Build a Spiceflow app with the redirect middleware + a catch-all
 *  fallback, then fire a request at it. Returns { status, location }
 *  for assertion. */
async function hit(
  rules: ConfigRedirect[],
  path: string,
): Promise<{ status: number; location: string | null }> {
  let app = new Spiceflow() as any
  app = registerRedirects(app, rules)
  app = app.get('/*', () => new Response('OK', { status: 200 }))
  const response = await app.handle(new Request('http://test.local' + path))
  return {
    status: response.status,
    location: response.headers.get('location'),
  }
}

describe('registerRedirects — exact paths', () => {
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

  test('trailing slash distinct from no-slash (middleware preserves)', async () => {
    const rules: ConfigRedirect[] = [
      { source: '/blog', destination: '/b' },
      { source: '/blog/', destination: '/b-slash' },
    ]
    expect((await hit(rules, '/blog')).location).toBe('/b')
    expect((await hit(rules, '/blog/')).location).toBe('/b-slash')
  })

  test('special path chars (dot/dash/underscore) match literally', async () => {
    const rules: ConfigRedirect[] = [
      { source: '/v1.0/api_key-old', destination: '/v1/keys' },
    ]
    expect((await hit(rules, '/v1.0/api_key-old')).location).toBe('/v1/keys')
    // `.` must match literal dot, not any char
    expect((await hit(rules, '/v1X0/api_key-old')).status).toBe(200)
  })
})

describe('registerRedirects — named params', () => {
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
    // no match → falls through to catch-all
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

describe('registerRedirects — trailing wildcard', () => {
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

  test('empty splat capture against trailing slash', async () => {
    const rules: ConfigRedirect[] = [
      { source: '/blog/*', destination: '/posts/:splat' },
    ]
    // `/blog/` has an empty splat
    expect((await hit(rules, '/blog/')).location).toBe('/posts/')
    // `/blog` (no trailing slash) does not match `/blog/*`
    expect((await hit(rules, '/blog')).status).toBe(200)
  })

  test('root wildcard /* matches everything including /', async () => {
    const rules: ConfigRedirect[] = [
      { source: '/*', destination: '/new/:splat' },
    ]
    expect((await hit(rules, '/')).location).toBe('/new/')
    expect((await hit(rules, '/anything')).location).toBe('/new/anything')
    expect((await hit(rules, '/nested/path')).location).toBe('/new/nested/path')
  })

  test('mixed :param + * splat', async () => {
    const res = await hit(
      [{ source: '/docs/:section/*', destination: '/d/:section/:splat' }],
      '/docs/api/v1/users',
    )
    expect(res.location).toBe('/d/api/v1/users')
  })
})

describe('registerRedirects — precedence', () => {
  test('exact path beats :param pattern declared LATER', async () => {
    const rules: ConfigRedirect[] = [
      { source: '/users/new', destination: '/signup' },
      { source: '/users/:id', destination: '/u/:id' },
    ]
    expect((await hit(rules, '/users/new')).location).toBe('/signup')
    expect((await hit(rules, '/users/42')).location).toBe('/u/42')
  })

  test('exact path beats :param pattern declared FIRST', async () => {
    // Critical: user wrote `:id` first, then `/users/new` as an exception.
    // Exact-Map lookup must beat the linear pattern scan.
    const rules: ConfigRedirect[] = [
      { source: '/users/:id', destination: '/u/:id' },
      { source: '/users/new', destination: '/signup' },
    ]
    expect((await hit(rules, '/users/new')).location).toBe('/signup')
    expect((await hit(rules, '/users/42')).location).toBe('/u/42')
  })

  test('exact path beats * splat declared first', async () => {
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

describe('registerRedirects — query string + hash preservation', () => {
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

describe('registerRedirects — no match / empty rules', () => {
  test('unmatched path falls through to catch-all', async () => {
    const res = await hit([{ source: '/old', destination: '/new' }], '/other')
    expect(res.status).toBe(200)
    expect(res.location).toBeNull()
  })

  test('empty rules: middleware is a no-op', async () => {
    const res = await hit([], '/anything')
    expect(res.status).toBe(200)
    expect(res.location).toBeNull()
  })
})

/* ── Pure helpers ──────────────────────────────────────────────────── */

describe('buildRedirectTable + matchRedirect (unit-level)', () => {
  test('splits rules into exact Map + pattern array', () => {
    const table = buildRedirectTable([
      { source: '/a', destination: '/b' },
      { source: '/users/:id', destination: '/u/:id' },
      { source: '/c', destination: '/d' },
      { source: '/blog/*', destination: '/posts/:splat' },
    ])
    expect(table.exact.size).toBe(2)
    expect(table.patterns.length).toBe(2)
    expect(table.exact.has('/a')).toBe(true)
    expect(table.exact.has('/c')).toBe(true)
  })

  test('exact Map lookup bypasses patterns', () => {
    const table = buildRedirectTable([
      { source: '/users/:id', destination: '/u/:id' },
      { source: '/users/new', destination: '/signup' },
    ])
    // Even though :id was declared first, /users/new is in the exact Map
    expect(matchRedirect(table, '/users/new')?.destination).toBe('/signup')
  })

  test('empty table → null', () => {
    const table = buildRedirectTable([])
    expect(matchRedirect(table, '/whatever')).toBeNull()
  })
})

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

describe('isExactSource', () => {
  test('literal path is exact', () => {
    expect(isExactSource('/home')).toBe(true)
  })
  test(':param is NOT exact', () => {
    expect(isExactSource('/users/:id')).toBe(false)
  })
  test('* wildcard is NOT exact', () => {
    expect(isExactSource('/blog/*')).toBe(false)
  })
  test('combined :param + * is NOT exact', () => {
    expect(isExactSource('/docs/:section/*')).toBe(false)
  })
  test('root / is exact', () => {
    expect(isExactSource('/')).toBe(true)
  })
})
