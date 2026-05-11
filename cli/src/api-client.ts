// API client for the Holocron website. Uses spiceflow's typed fetch client.
//
// Prefer getApiClient() which reads auth from config automatically.
// Use createApiClient() only when you have explicit credentials.
//
// The safeFetch client accepts `body` as a plain object (auto-serialized to JSON).
// Type safety on routes is intentionally omitted to avoid a circular workspace
// dependency (vite → cli → website → vite). Response shapes are typed inline
// at each call site instead.

import { createSpiceflowFetch } from 'spiceflow/client'
import { requireAuth } from './config.ts'

export function createApiClient(baseUrl: string, sessionToken: string) {
  const safeFetch = createSpiceflowFetch<any>(baseUrl, {
    headers: { Authorization: `Bearer ${sessionToken}` },
  })
  return { safeFetch }
}

/** Create an API client from the stored auth config. Throws if not logged in. */
export function getApiClient() {
  const auth = requireAuth()
  return createApiClient(auth.baseUrl, auth.sessionToken)
}
