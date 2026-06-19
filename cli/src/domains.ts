// Custom domain management commands: add, list, status, remove.
// Each command calls getManagementClient() for typed API access.
// Domains require a Pro subscription.

import * as clack from '@clack/prompts'
import { goke, isAgent } from 'goke'
import { stringify } from 'yaml'
import { getManagementClient } from './api-client.ts'
import { logger, colors } from './logger.ts'

export const domainCli = goke()

/** Resolve projectId from --project flag or interactive prompt. */
async function resolveProject(opts: {
  projectId: string | undefined
  output: { log: (...args: any[]) => void; error: (...args: any[]) => void }
  exit: (code: number) => void
}): Promise<string | undefined> {
  if (opts.projectId) return opts.projectId
  const nonInteractive = isAgent || !process.stdin.isTTY

  const { safeFetch } = getManagementClient()
  const projectsRes = await safeFetch('/api/v0/projects')
  if (projectsRes instanceof Error) {
    opts.output.error(logger.error(`Failed to list projects: ${projectsRes.message}`))
    opts.exit(1)
    return undefined
  }

  if (projectsRes.projects.length === 0) {
    opts.output.error(logger.error('No projects found. Create one first with `holocron projects create`.'))
    opts.exit(1)
    return undefined
  }

  if (nonInteractive) {
    opts.output.error(logger.error('Missing --project. Usage: holocron domain add --project <projectId> --hostname <domain>'))
    opts.exit(1)
    return undefined
  }

  const selected = await clack.select({
    message: 'Select a project:',
    options: projectsRes.projects.map((p) => ({
      value: p.projectId,
      label: p.name,
      hint: p.projectId,
    })),
  })
  if (clack.isCancel(selected)) {
    opts.exit(1)
    return undefined
  }
  return selected
}

domainCli
  .command('domain add', 'Add a custom domain to a project')
  .option('--project [projectId]', 'Project ID')
  .option('--hostname [hostname]', 'Custom domain (e.g. docs.mycompany.com)')
  .action(async (options, { console: output, process: proc }) => {
    const nonInteractive = isAgent || !process.stdin.isTTY
    const projectId = await resolveProject({ projectId: options.project, output, exit: (code) => proc.exit(code) })
    if (!projectId) return

    let hostname = options.hostname
    if (!hostname) {
      if (nonInteractive) {
        output.error(logger.error('Missing --hostname. Usage: holocron domain add --project <projectId> --hostname docs.mycompany.com'))
        return proc.exit(1)
      }
      const prompted = await clack.text({
        message: 'Custom domain (e.g. docs.mycompany.com):',
        validate: (v) => !v || v.length === 0 ? 'Hostname is required' : undefined,
      })
      if (clack.isCancel(prompted)) return proc.exit(1)
      hostname = prompted
    }

    const { safeFetch } = getManagementClient()
    const res = await safeFetch('/api/v0/domains', {
      method: 'POST',
      body: { projectId, hostname },
    })
    if (res instanceof Error) {
      output.error(logger.error(`Failed to add domain: ${res.message}`))
      return proc.exit(1)
    }

    output.log(logger.success('Custom domain added!'))
    output.log('')
    output.log(`  Hostname:  ${colors.bold(res.hostname)}`)
    output.log(`  Status:    ${res.status}`)
    output.log(`  SSL:       ${res.sslStatus || 'pending'}`)
    output.log('')
    output.log('Configure DNS to activate:')
    output.log('')
    output.log(`  ${colors.dim('Type:')}   CNAME`)
    output.log(`  ${colors.dim('Name:')}   ${colors.bold(hostname)}`)
    output.log(`  ${colors.dim('Value:')}  ${colors.green(res.cnameTarget)}`)
    output.log('')
    output.log(`Run ${colors.dim('holocron domain status --project ' + projectId)} to check when DNS and SSL are ready.`)
  })

domainCli
  .command('domain list', 'List custom domains for a project')
  .option('--project [projectId]', 'Project ID')
  .action(async (options, { console: output, process: proc }) => {
    const projectId = await resolveProject({ projectId: options.project, output, exit: (code) => proc.exit(code) })
    if (!projectId) return
    const { safeFetch } = getManagementClient()

    const res = await safeFetch('/api/v0/domains/:projectId', {
      params: { projectId },
    })
    if (res instanceof Error) {
      output.error(logger.error(`Failed to list domains: ${res.message}`))
      return proc.exit(1)
    }

    if (res.domains.length === 0) {
      output.log('No custom domains configured. Add one with `holocron domain add`.')
      return
    }

    const formatted = res.domains.map((d) => ({
      hostname: d.hostname,
      status: d.status,
      ssl: d.sslStatus || 'pending',
      cname: d.cnameTarget,
      created: new Date(d.createdAt).toISOString().slice(0, 10),
    }))

    output.log(stringify(formatted))
  })

domainCli
  .command('domain status', 'Check verification status of a domain')
  .option('--project [projectId]', 'Project ID')
  .option('--hostname [hostname]', 'Domain hostname to check')
  .action(async (options, { console: output, process: proc }) => {
    const projectId = await resolveProject({ projectId: options.project, output, exit: (code) => proc.exit(code) })
    if (!projectId) return
    const { safeFetch } = getManagementClient()

    // List domains to find the one matching the hostname
    const listRes = await safeFetch('/api/v0/domains/:projectId', {
      params: { projectId },
    })
    if (listRes instanceof Error) {
      output.error(logger.error(`Failed to list domains: ${listRes.message}`))
      return proc.exit(1)
    }

    let domainId: string
    const requestedHostname = options.hostname?.toLowerCase()
    if (requestedHostname) {
      const match = listRes.domains.find((d) => d.hostname === requestedHostname)
      if (!match) {
        output.error(logger.error(`Domain "${requestedHostname}" not found for this project.`))
        return proc.exit(1)
      }
      domainId = match.id
    } else if (listRes.domains.length === 1) {
      domainId = listRes.domains[0]!.id
    } else if (listRes.domains.length === 0) {
      output.log('No custom domains configured.')
      return
    } else {
      const nonInteractive = isAgent || !process.stdin.isTTY
      if (nonInteractive) {
        output.error(logger.error('Multiple domains found. Pass --hostname to select one.'))
        return proc.exit(1)
      }
      const selected = await clack.select({
        message: 'Select a domain:',
        options: listRes.domains.map((d) => ({
          value: d.id,
          label: d.hostname,
          hint: d.status,
        })),
      })
      if (clack.isCancel(selected)) return proc.exit(1)
      domainId = selected
    }

    const res = await safeFetch('/api/v0/domains/:projectId/:domainId/status', {
      params: { projectId, domainId },
    })
    if (res instanceof Error) {
      output.error(logger.error(`Failed to check domain status: ${res.message}`))
      return proc.exit(1)
    }

    output.log(`  Hostname:  ${colors.bold(res.hostname)}`)
    output.log(`  Status:    ${res.status === 'active' ? colors.green(res.status) : colors.yellow(res.status)}`)
    output.log(`  SSL:       ${res.sslStatus === 'active' ? colors.green(res.sslStatus) : colors.yellow(res.sslStatus || 'pending')}`)
    output.log(`  CNAME:     ${res.cnameTarget}`)

    if (res.status !== 'active') {
      output.log('')
      output.log('DNS is not yet pointing to Holocron. Add this CNAME record:')
      output.log(`  ${colors.dim('Name:')}   ${res.hostname}`)
      output.log(`  ${colors.dim('Value:')}  ${colors.green(res.cnameTarget)}`)
    }
  })

domainCli
  .command('domain remove', 'Remove a custom domain')
  .option('--project [projectId]', 'Project ID')
  .option('--hostname [hostname]', 'Domain hostname to remove')
  .option('--force', 'Skip confirmation')
  .action(async (options, { console: output, process: proc }) => {
    const projectId = await resolveProject({ projectId: options.project, output, exit: (code) => proc.exit(code) })
    if (!projectId) return
    const { safeFetch } = getManagementClient()

    // List domains to find the one matching
    const listRes = await safeFetch('/api/v0/domains/:projectId', {
      params: { projectId },
    })
    if (listRes instanceof Error) {
      output.error(logger.error(`Failed to list domains: ${listRes.message}`))
      return proc.exit(1)
    }

    let domainId: string
    let hostname: string
    const requestedRemoveHostname = options.hostname?.toLowerCase()
    if (requestedRemoveHostname) {
      const match = listRes.domains.find((d) => d.hostname === requestedRemoveHostname)
      if (!match) {
        output.error(logger.error(`Domain "${requestedRemoveHostname}" not found for this project.`))
        return proc.exit(1)
      }
      domainId = match.id
      hostname = match.hostname
    } else if (listRes.domains.length === 1) {
      domainId = listRes.domains[0]!.id
      hostname = listRes.domains[0]!.hostname
    } else if (listRes.domains.length === 0) {
      output.log('No custom domains configured.')
      return
    } else {
      const nonInteractive = isAgent || !process.stdin.isTTY
      if (nonInteractive) {
        output.error(logger.error('Multiple domains found. Pass --hostname to select one.'))
        return proc.exit(1)
      }
      const selected = await clack.select({
        message: 'Select a domain to remove:',
        options: listRes.domains.map((d) => ({
          value: d.id,
          label: d.hostname,
        })),
      })
      if (clack.isCancel(selected)) return proc.exit(1)
      domainId = selected
      hostname = listRes.domains.find((d) => d.id === domainId)!.hostname
    }

    if (!options.force) {
      const nonInteractive = isAgent || !process.stdin.isTTY
      if (nonInteractive) {
        output.error(logger.error('Use --force to remove non-interactively.'))
        return proc.exit(1)
      }
      const confirmed = await clack.confirm({
        message: `Remove domain ${hostname}? This will stop serving your site on this domain.`,
        initialValue: false,
      })
      if (clack.isCancel(confirmed) || !confirmed) {
        output.log('Cancelled.')
        return
      }
    }

    const res = await safeFetch('/api/v0/domains/:projectId/:domainId', {
      method: 'DELETE',
      params: { projectId, domainId },
    })
    if (res instanceof Error) {
      output.error(logger.error(`Failed to remove domain: ${res.message}`))
      return proc.exit(1)
    }

    output.log(logger.success(`Domain ${hostname} removed.`))
  })
