// Login command — authenticates with holocron.so via BetterAuth device flow.
// Opens the browser for the user to approve, polls until approved, saves the token.
// Requires a TTY terminal — fails fast in non-interactive environments.

import * as clack from '@clack/prompts'
import { goke, isAgent } from 'goke'
import { getBaseUrl, setServerAuth, clearServerAuth, getSessionToken, normalizeUrl } from './config.ts'
import { loginWithDeviceFlow } from './device-flow.ts'

export const loginCli = goke()

loginCli
  .command('login', 'Authenticate with Holocron via browser login')
  .action(async (_options, { console: output, process: proc }) => {
    if (isAgent || !process.stdin.isTTY) {
      output.error('Login requires an interactive terminal (device flow opens a browser).')
      output.error('Run `holocron login` in a TTY terminal, e.g. via tmux.')
      return proc.exit(1)
    }

    const baseUrl = getBaseUrl()
    clack.intro('Holocron — Login')

    const result = await loginWithDeviceFlow({
      baseUrl,
      exit: (code) => proc.exit(code),
    })

    setServerAuth(baseUrl, result.accessToken)
    clack.log.success(`Logged in to ${baseUrl}`)
    clack.outro('Done')
  })

loginCli
  .command('logout', 'Remove stored authentication')
  .action((_options, { console: output }) => {
    const baseUrl = getBaseUrl()
    clearServerAuth(baseUrl)
    output.log(`Logged out from ${normalizeUrl(baseUrl)}`)
  })

loginCli
  .command('whoami', 'Show current authenticated user')
  .action(async (_options, { console: output, process: proc }) => {
    const baseUrl = normalizeUrl(getBaseUrl())
    const sessionToken = getSessionToken(baseUrl)
    if (!sessionToken) {
      output.log(`Not logged in to ${baseUrl}. Run \`holocron login --api-url ${baseUrl}\` first.`)
      return proc.exit(1)
    }
    const res = await fetch(new URL('/api/auth/get-session', baseUrl), {
      headers: { Authorization: `Bearer ${sessionToken}` },
    })
    if (!res.ok) {
      output.log(`Session expired or invalid for ${baseUrl}. Run \`holocron login --api-url ${baseUrl}\` again.`)
      return proc.exit(1)
    }
    const session = await readJson<{ user?: { name?: string; email?: string } }>(res)
    output.log(`Logged in as ${session.user?.name || 'unknown'} (${session.user?.email || 'unknown'})`)
    output.log(`Server: ${baseUrl}`)
  })

async function readJson<T>(response: Response): Promise<T> {
  return (await response.json()) as T
}
