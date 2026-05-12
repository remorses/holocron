// API key management commands: create, list, delete.
// Each command calls getApiClient() internally for typed API access.
// Keys are always scoped to a project — the key alone identifies the project.

import * as clack from '@clack/prompts'
import { goke, isAgent } from 'goke'
import { stringify } from 'yaml'
import { getApiClient } from './api-client.ts'
import { logger, colors } from './logger.ts'

export const keysCli = goke()

keysCli
  .command('keys create', 'Create a new API key')
  .option('--name [name]', 'Name for the key (e.g. "production", "staging")')
  .option('--project [projectId]', 'Project ID to scope the key to')
  .action(async (options, { console: output, process: proc }) => {
    const { safeFetch } = getApiClient()
    const nonInteractive = isAgent || !process.stdin.isTTY

    let name = options.name
    if (!name) {
      if (nonInteractive) {
        output.error(logger.error('Missing --name. Usage: holocron keys create --name production --project <projectId>'))
        return proc.exit(1)
      }
      const prompted = await clack.text({
        message: 'Key name (e.g. "production", "staging"):',
        validate: (v) => !v || v.length === 0 ? 'Name is required' : undefined,
      })
      if (clack.isCancel(prompted)) return proc.exit(1)
      name = prompted
    }

    let projectId = options.project
    if (!projectId) {
      if (nonInteractive) {
        output.error(logger.error('Missing --project. Usage: holocron keys create --name production --project <projectId>'))
        return proc.exit(1)
      }

      // Fetch projects and let user pick
      const projectsRes = await safeFetch('/api/v0/projects')
      if (projectsRes instanceof Error) {
        output.error(logger.error(`Failed to list projects: ${projectsRes.message}`))
        return proc.exit(1)
      }

      if (projectsRes.projects.length === 0) {
        output.error(logger.error('No projects found. Create one first with `holocron projects create --name "My Docs"`.'))
        return proc.exit(1)
      }

      const selected = await clack.select({
        message: 'Select a project:',
        options: projectsRes.projects.map((p: any) => ({
          value: p.projectId,
          label: p.name,
          hint: p.projectId,
        })),
      })
      if (clack.isCancel(selected)) return proc.exit(1)
      projectId = selected as string
    }

    const res = await safeFetch('/api/v0/keys', {
      method: 'POST',
      body: { name, projectId },
    })
    if (res instanceof Error) {
      output.error(logger.error(`Failed to create key: ${res.message}`))
      return proc.exit(1)
    }

    output.log(logger.success('API key created!'))
    output.log('')
    output.log(`  Name:    ${colors.bold(res.name)}`)
    output.log(`  Project: ${colors.dim(projectId)}`)
    output.log(`  Prefix:  ${res.prefix}...`)
    output.log(`  Key:     ${colors.green(res.key)}`)
    output.log('')
    output.log(logger.warn('Save this key now. It will not be shown again.'))
    output.log('')
    output.log('Set it as an environment variable when deploying your docs site:')
    output.log(`  ${colors.dim('HOLOCRON_KEY=')}${colors.green(res.key)}`)
  })

keysCli
  .command('keys list', 'List all API keys')
  .action(async (_options, { console: output, process: proc }) => {
    const { safeFetch } = getApiClient()

    const res = await safeFetch('/api/v0/keys')
    if (res instanceof Error) {
      output.error(logger.error(`Failed to list keys: ${res.message}`))
      return proc.exit(1)
    }

    if (res.keys.length === 0) {
      output.log('No API keys found. Create one with `holocron keys create`.')
      return
    }

    const formatted = res.keys.map((k: any) => ({
      name: k.name,
      project: k.projectId,
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
      output.error(logger.error(`Failed to delete key: ${res.message}`))
      return proc.exit(1)
    }

    output.log(logger.success('Key deleted.'))
  })
