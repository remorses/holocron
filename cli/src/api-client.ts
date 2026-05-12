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
import { getBaseUrl, getSessionToken, loginHint } from './config.ts'

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

export const GITHUB_OIDC_HEADER = 'X-Holocron-GitHub-OIDC-Token'

/** Create a client authenticated with a GitHub Actions OIDC token. */
export function createGithubOidcClient(baseUrl: string, oidcToken: string) {
  const safeFetch = createSpiceflowFetch<App>(baseUrl, {
    headers: { [GITHUB_OIDC_HEADER]: oidcToken },
  })
  return { safeFetch }
}

/** Create an API client from the stored auth config. Throws if not logged in. */
export function getApiClient() {
  const baseUrl = getBaseUrl()
  const token = getSessionToken(baseUrl)
  if (!token) {
    throw new Error(`Not logged in. Run ${loginHint(baseUrl)} first.`)
  }
  return createSessionClient(baseUrl, token)
}

export type DeployAuth =
  | { type: 'apikey'; key: string; baseUrl: string }
  | { type: 'session'; token: string; baseUrl: string }
  | { type: 'github-oidc'; token: string; baseUrl: string }

/**
 * Resolve auth for deploy commands. Priority:
 *   1. HOLOCRON_KEY env var (loaded from process.env, which includes .env via dotenv)
 *   2. ~/.holocron/config.json session token for the resolved URL (from `holocron login`)
 *   3. GitHub Actions OIDC token
 */
export async function resolveDeployAuth(): Promise<DeployAuth> {
  const baseUrl = getBaseUrl()

  if (process.env.HOLOCRON_KEY) {
    return { type: 'apikey', key: process.env.HOLOCRON_KEY, baseUrl }
  }

  const token = getSessionToken(baseUrl)
  if (token) {
    return { type: 'session', token, baseUrl }
  }

  const oidcToken = await mintGitHubOidcToken(baseUrl)
  if (oidcToken) {
    return { type: 'github-oidc', token: oidcToken, baseUrl }
  }

  throw new Error(
    `Not authenticated. Set HOLOCRON_KEY in your environment, run ${loginHint(baseUrl)}, or deploy from GitHub Actions with id-token: write.`,
  )
}

/** Create an API client from the resolved deploy auth. */
export async function getDeployClient() {
  const auth = await resolveDeployAuth()
  if (auth.type === 'apikey') {
    return { ...createApiKeyClient(auth.baseUrl, auth.key), auth }
  }
  if (auth.type === 'session') {
    return { ...createSessionClient(auth.baseUrl, auth.token), auth }
  }
  return { ...createGithubOidcClient(auth.baseUrl, auth.token), auth }
}

export async function getDeployAuthHeaders(auth: DeployAuth): Promise<Record<string, string>> {
  if (auth.type === 'apikey') return { Authorization: `Bearer ${auth.key}` }
  if (auth.type === 'session') return { Authorization: `Bearer ${auth.token}` }
  const token = await mintGitHubOidcToken(auth.baseUrl)
  if (!token) throw new Error('Failed to refresh GitHub Actions OIDC token')
  return { [GITHUB_OIDC_HEADER]: token }
}

async function mintGitHubOidcToken(baseUrl: string): Promise<string | undefined> {
  const requestUrl = process.env.ACTIONS_ID_TOKEN_REQUEST_URL
  const requestToken = process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN
  if (!requestUrl || !requestToken || !process.env.GITHUB_REPOSITORY) return undefined

  const audience = new URL(baseUrl).origin
  const tokenUrl = `${requestUrl}&audience=${encodeURIComponent(audience)}`
  const res = await fetch(tokenUrl, {
    headers: { authorization: `bearer ${requestToken}` },
  })
  if (!res.ok) return undefined
  const data = await res.json() as { value?: string }
  return typeof data.value === 'string' ? data.value : undefined
}
