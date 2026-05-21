// Login command — authenticates with holocron.so via BetterAuth device flow.
// Opens the browser for the user to approve, polls until approved, saves the token.
// Requires a TTY terminal — fails fast in non-interactive environments.

import { goke, isAgent } from 'goke'
import * as clack from '@clack/prompts'
import { stringify } from 'yaml'
import { getBaseUrl, setServerAuth, clearServerAuth, getSessionToken, normalizeUrl, loginHint } from './config.ts'
import { loginWithDeviceFlow } from './device-flow.ts'
import { getApiClient } from './api-client.ts'
import { logger, colors } from './logger.ts'

export const loginCli = goke()

loginCli
  .command('login', 'Authenticate with Holocron via browser login')
  .action(async (_options, { console: output, process: proc }) => {
    if (isAgent || !process.stdin.isTTY) {
      output.error(logger.error('Login requires an interactive terminal (device flow opens a browser)'))
      output.error(logger.error('Run `holocron login` in a TTY terminal, e.g. via tmux'))
      return proc.exit(1)
    }

    const baseUrl = getBaseUrl()
    clack.intro('Holocron — Login')

    const result = await loginWithDeviceFlow({
      baseUrl,
      exit: (code) => proc.exit(code),
    })

    setServerAuth(baseUrl, result.accessToken)
    output.log(logger.success(`Logged in to ${colors.bold(baseUrl)}`))
    clack.outro('Done')
  })

loginCli
  .command('logout', 'Remove stored authentication')
  .action((_options, { console: output }) => {
    const baseUrl = getBaseUrl()
    clearServerAuth(baseUrl)
    output.log(logger.success(`Logged out from ${colors.bold(normalizeUrl(baseUrl))}`))
  })

loginCli
  .command('whoami', 'Show current user, orgs, and projects')
  .action(async (_options, { console: output, process: proc }) => {
    const baseUrl = normalizeUrl(getBaseUrl())
    const sessionToken = getSessionToken(baseUrl)
    if (!sessionToken) {
      output.error(logger.error(`Not logged in. Run ${loginHint(baseUrl)} first.`))
      return proc.exit(1)
    }

    const { safeFetch } = getApiClient()
    const res = await safeFetch('/api/v0/me')
    if (res instanceof Error) {
      output.error(logger.error(`Session expired or invalid. Run ${loginHint(baseUrl)} again.`))
      return proc.exit(1)
    }

    output.log(logger.success(`Logged in as ${colors.bold(res.user.name)} ${colors.dim(`(${res.user.email})`)}`))
    output.log(logger.info(`Server: ${colors.dim(baseUrl)}`))
    output.log('')

    if (res.orgs.length === 0) {
      output.log('No organizations yet. One will be created on your first deploy or project creation.')
      return
    }

    for (const org of res.orgs) {
      output.log(`${colors.bold(org.name)} ${colors.dim(`(${org.id})`)} ${colors.dim(`role: ${org.role}`)}`)

      if (org.projects.length === 0) {
        output.log(`  No projects. Create one with: ${colors.dim('holocron projects create --name "My Docs"')}`)
      } else {
        const formatted = org.projects.map((p: any) => ({
          id: p.projectId,
          name: p.name,
          ...(p.githubOwner && p.githubRepo ? { github: `${p.githubOwner}/${p.githubRepo}` } : {}),
          created: new Date(p.createdAt).toISOString().slice(0, 10),
        }))
        output.log(stringify(formatted).trimEnd().split('\n').map((l: string) => `  ${l}`).join('\n'))
      }
      output.log('')
    }
  })
