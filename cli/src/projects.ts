// Project management commands: list, create.
// Each command calls getApiClient() internally for typed API access.
//
// projects list: returns projects from ALL orgs the user belongs to, with org name.
// projects create: accepts --org to target a specific org. If the user has multiple
// orgs and no --org is given, prompts interactively.

import * as clack from '@clack/prompts'
import { goke, isAgent } from 'goke'
import { stringify } from 'yaml'
import { getApiClient } from './api-client.ts'
import { logger, colors } from './logger.ts'

export const projectsCli = goke()

projectsCli
  .command('projects list', 'List all projects')
  .action(async (_options, { console: output, process: proc }) => {
    const { safeFetch } = getApiClient()

    const res = await safeFetch('/api/v0/projects')
    if (res instanceof Error) {
      output.error(logger.error(`Failed to list projects: ${res.message}`))
      return proc.exit(1)
    }

    if (res.projects.length === 0) {
      output.log('No projects found. Create one with `holocron projects create --name "My Docs"`.')
      return
    }

    const formatted = res.projects.map((p) => ({
      id: p.projectId,
      name: p.name,
      org: p.orgName,
      ...(p.githubOwner && p.githubRepo ? { github: `${p.githubOwner}/${p.githubRepo}` } : {}),
      created: new Date(p.createdAt).toISOString().slice(0, 10),
    }))

    output.log(stringify(formatted))
  })

projectsCli
  .command('projects create', 'Create a new project')
  .option('--name [name]', 'Project name')
  .option('--org [orgId]', 'Org ID to create the project in (see `holocron whoami` for org IDs)')
  .action(async (options, { console: output, process: proc }) => {
    const { safeFetch } = getApiClient()
    const nonInteractive = isAgent || !process.stdin.isTTY

    let name = options.name
    if (!name) {
      if (nonInteractive) {
        output.error(logger.error('Missing --name. Usage: holocron projects create --name "My Docs"'))
        return proc.exit(1)
      }
      const prompted = await clack.text({
        message: 'Project name:',
        validate: (v) => !v || v.length === 0 ? 'Name is required' : undefined,
      })
      if (clack.isCancel(prompted)) return proc.exit(1)
      name = prompted
    }

    // Resolve org: explicit flag, interactive selection if multiple, or let server pick default
    let orgId = options.org
    if (!orgId && !nonInteractive) {
      const meRes = await safeFetch('/api/v0/me')
      if (!(meRes instanceof Error) && meRes.orgs.length > 1) {
        const selected = await clack.select({
          message: 'Which org should own this project?',
          options: meRes.orgs.map((o) => ({
            value: o.id,
            label: o.name,
            hint: `${o.projects.length} project${o.projects.length === 1 ? '' : 's'}`,
          })),
        })
        if (clack.isCancel(selected)) return proc.exit(1)
        orgId = selected as string
      }
    }

    const res = await safeFetch('/api/v0/projects', {
      method: 'POST',
      body: { name, ...(orgId ? { orgId } : {}) },
    })
    if (res instanceof Error) {
      output.error(logger.error(`Failed to create project: ${res.message}`))
      return proc.exit(1)
    }

    output.log(logger.success('Project created!'))
    output.log('')
    output.log(`  Name: ${colors.bold(res.name)}`)
    output.log(`  ID:   ${colors.dim(res.projectId)}`)
    output.log('')
    output.log('Now create an API key for this project:')
    output.log(`  ${colors.dim('holocron keys create --name production --project')} ${res.projectId}`)
  })
