// Login command — authenticates with holocron.so via BetterAuth device flow.
// Opens the browser for the user to approve, polls until approved, saves the token.
// Requires a TTY terminal — fails fast in non-interactive environments.

import * as clack from '@clack/prompts'
import { goke, isAgent } from 'goke'
import { getBaseUrl, setServerAuth, clearServerAuth, getSessionToken, normalizeUrl, loginHint } from './config.ts'
import { loginWithDeviceFlow } from './device-flow.ts'
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
  .command('whoami', 'Show current authenticated user')
  .action(async (_options, { console: output, process: proc }) => {
    const baseUrl = normalizeUrl(getBaseUrl())
    const sessionToken = getSessionToken(baseUrl)
    if (!sessionToken) {
      output.error(logger.error(`Not logged in. Run ${loginHint(baseUrl)} first.`))
      return proc.exit(1)
    }
    const res = await fetch(new URL('/api/auth/get-session', baseUrl), {
      headers: { Authorization: `Bearer ${sessionToken}` },
    })
    if (!res.ok) {
      output.error(logger.error(`Session expired or invalid. Run ${loginHint(baseUrl)} again.`))
      return proc.exit(1)
    }
    const session = await readJson<{ user?: { name?: string; email?: string } }>(res)
    output.log(logger.success(`Logged in as ${colors.bold(session.user?.name || 'unknown')} ${colors.dim(`(${session.user?.email || 'unknown'})`)}`))
    output.log(logger.info(`Server: ${colors.dim(baseUrl)}`))
  })

async function readJson<T>(response: Response): Promise<T> {
  return (await response.json()) as T
}
