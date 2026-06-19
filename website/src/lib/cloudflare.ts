// Cloudflare SSL for SaaS client for custom hostname management.
// All custom domains CNAME to acme.holocron.so (the fallback origin).
// Cloudflare terminates SSL and routes traffic to the hosting worker.
// The hosting worker resolves the hostname via KV to the project subdomain.
//
// Zone ID and API token are read from env (Cloudflare Workers secrets).
// The zone is holocron.so for all custom hostnames.

import { env } from 'cloudflare:workers'

export type CloudflareSSLStatus =
  | 'initializing'
  | 'pending_validation'
  | 'deleted'
  | 'pending_issuance'
  | 'pending_deployment'
  | 'pending_expiration'
  | 'expired'
  | 'active'
  | 'initializing_timed_out'
  | 'validation_timed_out'
  | 'issuance_timed_out'
  | 'deployment_timed_out'
  | 'deletion_timed_out'
  | 'pending_cleanup'
  | 'staging_deployment'
  | 'staging_active'
  | 'deactivating'
  | 'inactive'
  | 'backup_issued'
  | 'holding_deployment'

export type CloudflareHostnameStatus =
  | 'active'
  | 'pending'
  | 'active_redeploying'
  | 'moved'
  | 'pending_deletion'
  | 'deleted'
  | 'pending_blocked'
  | 'pending_migration'
  | 'pending_provisioned'
  | 'test_pending'
  | 'test_active'
  | 'test_active_apex'
  | 'test_blocked'
  | 'test_failed'
  | 'provisioned'
  | 'blocked'

export type CustomHostnameResult = {
  id: string
  hostname: string
  ssl: {
    id?: string
    type?: string
    method?: string
    status: CloudflareSSLStatus
    wildcard?: boolean
    certificate_authority?: string
  }
  status: CloudflareHostnameStatus
  ownership_verification?: {
    type: string
    name: string
    value: string
  }
  ownership_verification_http?: {
    http_url: string
    http_body: string
  }
  created_at: string
}

/** The single CNAME target all custom domains should point to. */
export const CNAME_TARGET = 'acme.holocron.so'

async function cfFetch(path: string, init?: RequestInit): Promise<any> {
  const zoneId = env.CLOUDFLARE_HOSTING_ZONE_ID
  const token = env.CLOUDFLARE_HOSTING_API_TOKEN
  if (!zoneId || !token) {
    throw new Error('CLOUDFLARE_HOSTING_ZONE_ID and CLOUDFLARE_HOSTING_API_TOKEN must be set')
  }
  const res = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...init?.headers,
    },
  })
  if (!res.ok) {
    const text = await res.text()
    console.error(`Cloudflare API error: ${res.status} ${res.statusText}`, text)
    throw new Error(`Cloudflare API request failed: ${res.status} ${res.statusText}`)
  }
  return res.json()
}

/** Register a custom hostname with Cloudflare SSL for SaaS.
 *  SSL is provisioned via HTTP DCV (domain control validation)
 *  once the user's CNAME is pointing to acme.holocron.so. */
export async function createCustomHostname(hostname: string): Promise<CustomHostnameResult> {
  const data = await cfFetch('/custom_hostnames', {
    method: 'POST',
    body: JSON.stringify({
      hostname,
      ssl: {
        type: 'dv',
        method: 'http',
      },
    }),
  })
  return data.result as CustomHostnameResult
}

/** Look up a custom hostname by its domain name.
 *  Returns null if not found in Cloudflare. */
export async function getCustomHostname(hostname: string): Promise<CustomHostnameResult | null> {
  const data = await cfFetch(`/custom_hostnames?hostname=${encodeURIComponent(hostname)}`, {
    method: 'GET',
  })
  if (!data.result?.length) return null
  return data.result[0] as CustomHostnameResult
}

/** Delete a custom hostname by its Cloudflare ID.
 *  Treats 404 (already deleted) as success for idempotency. */
export async function deleteCustomHostname(cfId: string): Promise<void> {
  const zoneId = env.CLOUDFLARE_HOSTING_ZONE_ID
  const token = env.CLOUDFLARE_HOSTING_API_TOKEN
  if (!zoneId || !token) {
    throw new Error('CLOUDFLARE_HOSTING_ZONE_ID and CLOUDFLARE_HOSTING_API_TOKEN must be set')
  }
  const res = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/custom_hostnames/${cfId}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  })
  // 404 means already deleted; treat as success for idempotent retries
  if (res.ok || res.status === 404) return
  const text = await res.text()
  console.error(`Cloudflare API error: ${res.status} ${res.statusText}`, text)
  throw new Error(`Cloudflare API request failed: ${res.status} ${res.statusText}`)
}

/** Re-check a custom hostname's status (triggers Cloudflare to re-validate). */
export async function refreshCustomHostname(cfId: string): Promise<CustomHostnameResult> {
  const data = await cfFetch(`/custom_hostnames/${cfId}`, {
    method: 'PATCH',
    body: JSON.stringify({ ssl: { method: 'http', type: 'dv' } }),
  })
  return data.result as CustomHostnameResult
}
