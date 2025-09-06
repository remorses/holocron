import { env } from './env'
import { AppError } from './errors.js'
import { groupByN } from './utils.js'

const { CLOUDFLARE_API_TOKEN, CLOUDFLARE_ZONE_ID } = env

type CloudflareSSLStatus =
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

type CloudflareHostnameStatus =
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

export type CloudflareCustomHostnameResponse = {
  result: {
    id: string
    hostname: string
    ssl: {
      id: string
      type: string
      method: string
      status: CloudflareSSLStatus
      wildcard: boolean
      certificate_authority: string
    }
    status: CloudflareHostnameStatus
    ownership_verification: {
      type: string
      name: string
      value: string
    }
    ownership_verification_http: {
      http_url: string
      http_body: string
    }
    created_at: string
  }
  success: boolean
  errors: any[]
  messages: any[]
}

export const CloudflareZones = {
  holocronso: 'ee6e7769d681906f642bd72c11647d33',
  fumabasecom: '856baddaec9272d348d34fc7ad3c5efe',
  holocronsitescom: 'febc04e7bb560e93bee7c556a814548e',
  holocronlive: '1d8dcc0b7173dcb3a79441c6e7cd12fb',
}

export const getZoneIdForDomain = (domain: string): string => {
  if (domain.endsWith('fumabase.com')) {
    return CloudflareZones.fumabasecom
  }
  if (domain.endsWith('holocronsites.com')) {
    return CloudflareZones.holocronsitescom
  }
  if (domain.endsWith('holocron.live')) {
    return CloudflareZones.holocronlive
  }
  // Default to holocronso for all other cases
  return CloudflareZones.holocronso
}

export class CloudflareClient {
  private zoneId: string

  constructor({ zoneId }: { zoneId: string }) {
    this.zoneId = zoneId
  }

  private fetch = async (path: string, init?: RequestInit): Promise<any> => {
    const res = await fetch(`https://api.cloudflare.com/client/v4/zones/${this.zoneId}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${CLOUDFLARE_API_TOKEN}`,
        ...init?.headers,
      },
    })
    if (!res.ok) {
      console.error(await res.text())
      throw new AppError(`Cloudflare API request failed: ${res.status} ${res.statusText}`)
    }
    return res.json()
  }

  async invalidateCacheTags(tags: string[]): Promise<
    {
      result: any
      success: boolean
      errors: any[]
      messages: any[]
    }[]
  > {
    const batches: string[][] = groupByN<string>(tags, 100)
    const results: {
      result: any
      success: boolean
      errors: any[]
      messages: any[]
    }[] = []
    for (const batch of batches) {
      if (batch.length > 0) {
        console.log(`Cloudflare: invalidating cache for ${batch.length} tag(s): ${batch.join(', ')}`)
        const res = await this.fetch('/purge_cache', {
          method: 'POST',
          body: JSON.stringify({
            tags: batch,
          }),
        })
        results.push(res)
      }
    }
    return results
  }
  async createDomain(domain: string): Promise<CloudflareCustomHostnameResponse> {
    if (domain.endsWith('.localhost')) {
      console.log(`skipping creating domain ${domain} in cloudflare`)
      return {} as any
    }
    if (domain.endsWith(env.APPS_DOMAIN!)) {
      console.log(`skipping creating domain ${domain} in cloudflare`)
      return {} as any
    }
    return await this.fetch('/custom_hostnames', {
      method: 'POST',
      body: JSON.stringify({
        hostname: domain,
        ssl: {
          type: 'dv',
          method: 'http',
        },

        // you have to pay for this...
        // custom_metadata: {
        // 	appId: domainRoute.appId,
        // 	resourceId: domainRoute.resourceId,
        // 	planId: domainRoute.planId,
        // 	createdAt: domainRoute.createdAt,
        // },
      }),
    })
  }
  async get(hostname: string) {
    const res = await this.fetch(`/custom_hostnames?hostname=${hostname}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })
    if (res.errors?.length) {
      throw new AppError(`Cloudflare API request failed: ${res.errors}`)
    }
    console.log(res.result[0])
    return res.result[0] as {
      id: string
      ssl: {
        id: string
        // others...
        expires_on: string
        status: CloudflareSSLStatus
      }
      custom_metadata: {
        appId: string
        resourceId: string
        planId: string
        createdAt: Date
      }
      ownership_verification: {
        name: string
        type: string
        value: string
      }
      status: CloudflareHostnameStatus
    }
  }

  async removeDomain(hostname: string) {
    const data = await this.get(hostname)
    if (!data) {
      throw new AppError(`Custom hostname ${hostname} not found`)
    }
    return this.fetch(`/custom_hostnames/${data.id}`, {
      method: 'DELETE',
    })
  }
}

// Note: This export is deprecated. Create new instances with appropriate zone IDs instead.
// export const cloudflareClient = new CloudflareClient(CloudflareZones.holocronso)
