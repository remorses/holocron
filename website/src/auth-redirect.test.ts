// Covers auth callback URL normalization so internal RSC transport URLs never
// escape into browser-visible OAuth redirects.

import { expect, test } from 'vitest'
import { normalizeAuthRedirectPath } from './auth-redirect.ts'

test('normalizeAuthRedirectPath strips RSC transport markers from callback URLs', () => {
  const results = [
    [undefined, '/dashboard'],
    ['', '/dashboard'],
    ['https://evil.com/dashboard', '/dashboard'],
    ['//evil.com/dashboard', '/dashboard'],
    ['/dashboard?__rsc=', '/dashboard'],
    ['/dashboard.rsc?__rsc=', '/dashboard'],
    ['/dashboard?project=abc&__rsc=', '/dashboard?project=abc'],
    ['/device?user_code=123&__rsc=', '/device?user_code=123'],
    ['/dashboard?tab=keys#api', '/dashboard?tab=keys#api'],
  ].map(([input, expected]) => ({ input, actual: normalizeAuthRedirectPath(input), expected }))

  expect(results).toMatchInlineSnapshot(`
    [
      {
        "actual": "/dashboard",
        "expected": "/dashboard",
        "input": undefined,
      },
      {
        "actual": "/dashboard",
        "expected": "/dashboard",
        "input": "",
      },
      {
        "actual": "/dashboard",
        "expected": "/dashboard",
        "input": "https://evil.com/dashboard",
      },
      {
        "actual": "/dashboard",
        "expected": "/dashboard",
        "input": "//evil.com/dashboard",
      },
      {
        "actual": "/dashboard",
        "expected": "/dashboard",
        "input": "/dashboard?__rsc=",
      },
      {
        "actual": "/dashboard",
        "expected": "/dashboard",
        "input": "/dashboard.rsc?__rsc=",
      },
      {
        "actual": "/dashboard?project=abc",
        "expected": "/dashboard?project=abc",
        "input": "/dashboard?project=abc&__rsc=",
      },
      {
        "actual": "/device?user_code=123",
        "expected": "/device?user_code=123",
        "input": "/device?user_code=123&__rsc=",
      },
      {
        "actual": "/dashboard?tab=keys#api",
        "expected": "/dashboard?tab=keys#api",
        "input": "/dashboard?tab=keys#api",
      },
    ]
  `)
})
