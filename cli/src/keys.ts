// API key management commands: create, list, delete.
// Each command calls getApiClient() internally for typed API access.

import * as clack from '@clack/prompts'
import { goke } from 'goke'
import { stringify } from 'yaml'
import { getApiClient } from './api-client.ts'

export const keysCli = goke()

keysCli
  .command('keys create', 'Create a new API key')
  .option('--name <name>', 'Name for the key (e.g. "production", "staging")')
  .action(async (options, { console: output, process: proc }) => {
    const { safeFetch } = getApiClient()

    let name = options.name
    if (!name) {
      const prompted = await clack.text({
        message: 'Key name (e.g. "production", "staging"):',
        validate: (v) => !v || v.length === 0 ? 'Name is required' : undefined,
      })
      if (clack.isCancel(prompted)) return proc.exit(1)
      name = prompted
    }

    const res = await safeFetch('/api/v0/keys', {
      method: 'POST',
      body: { name },
    })
    if (res instanceof Error) {
      clack.log.error(`Failed to create key: ${res.message}`)
      return proc.exit(1)
    }

    clack.log.success('API key created successfully!')
    output.log('')
    output.log(`  Name:   ${res.name}`)
    output.log(`  Prefix: ${res.prefix}...`)
    output.log(`  Key:    ${res.key}`)
    output.log('')
    clack.log.warn('Save this key now. It will not be shown again.')
    output.log('')
    output.log('Set it as an environment variable when deploying your docs site:')
    output.log(`  HOLOCRON_KEY=${res.key}`)
  })

keysCli
  .command('keys list', 'List all API keys')
  .action(async (_options, { console: output, process: proc }) => {
    const { safeFetch } = getApiClient()

    const res = await safeFetch('/api/v0/keys')
    if (res instanceof Error) {
      clack.log.error(`Failed to list keys: ${res.message}`)
      return proc.exit(1)
    }

    if (res.keys.length === 0) {
      output.log('No API keys found. Create one with `holocron keys create`.')
      return
    }

    const formatted = res.keys.map((k: { name: string; prefix: string; createdAt: number | null }) => ({
      name: k.name,
      prefix: `holo_${k.prefix}...`,
      created: k.createdAt ? new Date(k.createdAt).toISOString().slice(0, 10) : 'unknown',
    }))

    output.log(stringify(formatted))
  })

keysCli
  .command('keys delete <keyId>', 'Delete an API key by ID')
  .action(async (keyId, _options, { console: output, process: proc }) => {
    const { safeFetch } = getApiClient()

    const confirmed = await clack.confirm({
      message: `Delete key ${keyId}? This cannot be undone.`,
    })
    if (clack.isCancel(confirmed) || !confirmed) {
      output.log('Cancelled.')
      return
    }

    const res = await safeFetch('/api/v0/keys/:id', {
      method: 'DELETE',
      params: { id: keyId },
    })
    if (res instanceof Error) {
      clack.log.error(`Failed to delete key: ${res.message}`)
      return proc.exit(1)
    }

    clack.log.success('Key deleted.')
  })
