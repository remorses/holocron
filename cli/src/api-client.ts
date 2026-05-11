// API client for the Holocron website. Uses spiceflow's typed fetch client.
//
// Prefer getApiClient() which reads auth from config automatically.
// Use createApiClient() only when you have explicit credentials.
//
// The safeFetch client accepts `body` as a plain object (auto-serialized to JSON)
// and is fully type-safe on path params, query, body, and response.
//
// The `App` type is imported from website SOURCE (not dist) so no build order
// dependency exists. Ambient stubs in cli/src/website-ambient.d.ts satisfy
// unresolvable modules in the website's transitive import graph.

import { createSpiceflowFetch } from 'spiceflow/client'
import type { App } from 'website/src/server.tsx'
import { getBaseUrl, getSessionToken } from './config.ts'

/** Create a client authenticated with a session token (from `holocron login`). */
export function createSessionClient(baseUrl: string, sessionToken: string) {
  const safeFetch = createSpiceflowFetch<App>(baseUrl, {
    headers: { Authorization: `Bearer ${sessionToken}` },
  })
  return { safeFetch }
}

/** Create a client authenticated with an API key (HOLOCRON_KEY). */
export function createApiKeyClient(baseUrl: string, apiKey: string) {
  const safeFetch = createSpiceflowFetch<App>(baseUrl, {
    headers: { Authorization: `Bearer ${apiKey}` },
  })
  return { safeFetch }
}

/** Create an API client from the stored auth config. Throws if not logged in. */
export function getApiClient() {
  const baseUrl = getBaseUrl()
  const token = getSessionToken(baseUrl)
  if (!token) {
    throw new Error(`Not logged in to ${baseUrl}. Run \`holocron login --api-url ${baseUrl}\` first.`)
  }
  return createSessionClient(baseUrl, token)
}

export type DeployAuth =
  | { type: 'apikey'; key: string; baseUrl: string }
  | { type: 'session'; token: string; baseUrl: string }

/**
 * Resolve auth for deploy commands. Priority:
 *   1. HOLOCRON_KEY env var (loaded from process.env, which includes .env via dotenv)
 *   2. ~/.holocron/config.json session token for the resolved URL (from `holocron login`)
 */
export function resolveDeployAuth(): DeployAuth {
  const baseUrl = getBaseUrl()

  if (process.env.HOLOCRON_KEY) {
    return { type: 'apikey', key: process.env.HOLOCRON_KEY, baseUrl }
  }

  const token = getSessionToken(baseUrl)
  if (token) {
    return { type: 'session', token, baseUrl }
  }

  throw new Error(
    `Not authenticated for ${baseUrl}. Set HOLOCRON_KEY in your environment or .env file, or run \`holocron login --api-url ${baseUrl}\`.`,
  )
}

/** Create an API client from the resolved deploy auth. */
export function getDeployClient() {
  const auth = resolveDeployAuth()
  if (auth.type === 'apikey') {
    return { ...createApiKeyClient(auth.baseUrl, auth.key), auth }
  }
  return { ...createSessionClient(auth.baseUrl, auth.token), auth }
}
