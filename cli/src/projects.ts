// Project management commands: list, create.
// Each command calls getApiClient() internally for typed API access.

import * as clack from '@clack/prompts'
import { goke, isAgent } from 'goke'
import { stringify } from 'yaml'
import { getApiClient } from './api-client.ts'

export const projectsCli = goke()

projectsCli
  .command('projects list', 'List all projects')
  .action(async (_options, { console: output, process: proc }) => {
    const { safeFetch } = getApiClient()

    const res = await safeFetch('/api/v0/projects')
    if (res instanceof Error) {
      clack.log.error(`Failed to list projects: ${res.message}`)
      return proc.exit(1)
    }

    if (res.projects.length === 0) {
      output.log('No projects found. Create one with `holocron projects create --name "My Docs"`.')
      return
    }

    const formatted = res.projects.map((p: { projectId: string; name: string; githubOwner: string | null; githubRepo: string | null; createdAt: number }) => ({
      id: p.projectId,
      name: p.name,
      ...(p.githubOwner && p.githubRepo ? { github: `${p.githubOwner}/${p.githubRepo}` } : {}),
      created: new Date(p.createdAt).toISOString().slice(0, 10),
    }))

    output.log(stringify(formatted))
  })

projectsCli
  .command('projects create', 'Create a new project')
  .option('--name <name>', 'Project name')
  .action(async (options, { console: output, process: proc }) => {
    const { safeFetch } = getApiClient()

    let name = options.name
    if (!name) {
      if (isAgent || !process.stdin.isTTY) {
        clack.log.error('Missing --name. Usage: holocron projects create --name "My Docs"')
        return proc.exit(1)
      }
      const prompted = await clack.text({
        message: 'Project name:',
        validate: (v) => !v || v.length === 0 ? 'Name is required' : undefined,
      })
      if (clack.isCancel(prompted)) return proc.exit(1)
      name = prompted
    }

    const res = await safeFetch('/api/v0/projects', {
      method: 'POST',
      body: { name },
    })
    if (res instanceof Error) {
      clack.log.error(`Failed to create project: ${res.message}`)
      return proc.exit(1)
    }

    clack.log.success('Project created!')
    output.log('')
    output.log(`  Name: ${res.name}`)
    output.log(`  ID:   ${res.projectId}`)
    output.log('')
    output.log('Now create an API key for this project:')
    output.log(`  holocron keys create --name production --project ${res.projectId}`)
  })
