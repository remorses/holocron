// Typed API client for the Holocron website. Uses spiceflow's typed fetch client
// with the built website declaration type for compile-time route validation.
//
// Prefer getApiClient() which reads auth from config automatically.
// Use createApiClient() only when you have explicit credentials.
//
// The safeFetch client accepts `body` as a plain object (auto-serialized to JSON)
// and is fully type-safe on path params, query, body, and response.

import { createSpiceflowFetch } from 'spiceflow/client'
import type { App } from 'website/dist/src/server.d.ts'
import { requireAuth } from './config.ts'

export function createApiClient(baseUrl: string, sessionToken: string) {
  const safeFetch = createSpiceflowFetch<App>(baseUrl, {
    headers: { Authorization: `Bearer ${sessionToken}` },
  })
  return { safeFetch }
}

/** Create an API client from the stored auth config. Throws if not logged in. */
export function getApiClient() {
  const auth = requireAuth()
  return createApiClient(auth.baseUrl, auth.sessionToken)
}
