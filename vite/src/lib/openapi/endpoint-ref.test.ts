import { describe, expect, test } from 'vitest'
import { parseEndpointRef, endpointKey } from './endpoint-ref.ts'

describe('parseEndpointRef', () => {
  test('parses all HTTP methods', () => {
    expect(parseEndpointRef('GET /users')).toMatchInlineSnapshot(`
      {
        "method": "get",
        "path": "/users",
      }
    `)
    expect(parseEndpointRef('POST /users')).toMatchInlineSnapshot(`
      {
        "method": "post",
        "path": "/users",
      }
    `)
    expect(parseEndpointRef('delete /users/{id}')).toMatchInlineSnapshot(`
      {
        "method": "delete",
        "path": "/users/{id}",
      }
    `)
  })

  test('parses the multi-spec "specfile METHOD /path" form', () => {
    expect(parseEndpointRef('v2.json POST /orders')).toMatchInlineSnapshot(`
      {
        "method": "post",
        "path": "/orders",
        "specFile": "v2.json",
      }
    `)
    expect(parseEndpointRef('openapi/v1.json GET /users/{id}')).toMatchInlineSnapshot(`
      {
        "method": "get",
        "path": "/users/{id}",
        "specFile": "openapi/v1.json",
      }
    `)
  })

  test('returns null for normal MDX slugs', () => {
    expect(parseEndpointRef('api/authentication')).toBeNull()
    expect(parseEndpointRef('overview')).toBeNull()
    expect(parseEndpointRef('guides/get-started')).toBeNull()
    // "get-users" is a single token (no whitespace) → slug, not endpoint
    expect(parseEndpointRef('get-users')).toBeNull()
  })

  test('case-insensitive method, trims whitespace', () => {
    expect(parseEndpointRef('  Get /users  ')).toMatchInlineSnapshot(`
      {
        "method": "get",
        "path": "/users",
      }
    `)
  })
})

describe('endpointKey', () => {
  test('keeps the path literal (no trailing-slash normalization)', () => {
    // OpenAPI path keys are literal — /users and /users/ are distinct.
    expect(endpointKey('get', '/users/')).toBe('get /users/')
    expect(endpointKey('post', '/users')).toBe('post /users')
    expect(endpointKey('get', '/')).toBe('get /')
  })
})
