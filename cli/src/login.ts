// Login command — authenticates with holocron.so via BetterAuth device flow.
// Opens the browser for the user to approve, polls until approved, saves the token.

import * as clack from '@clack/prompts'
import { goke } from 'goke'
import { getBaseUrl, saveConfig } from './config.ts'
import { loginWithDeviceFlow } from './device-flow.ts'

export const loginCli = goke()

loginCli
  .command('login', 'Authenticate with Holocron via browser login')
  .option('-u, --url [url]', 'Holocron website URL (default: https://holocron.so)')
  .action(async (options, { process: proc }) => {
    const baseUrl = options.url || getBaseUrl()
    clack.intro('Holocron — Login')

    const result = await loginWithDeviceFlow({
      baseUrl,
      exit: (code) => proc.exit(code),
    })

    saveConfig({ sessionToken: result.accessToken, baseUrl })
    clack.log.success(`Logged in to ${baseUrl}`)
    clack.outro('Done')
  })

loginCli
  .command('logout', 'Remove stored authentication')
  .action((_options, { console: output }) => {
    saveConfig({})
    output.log('Logged out.')
  })

loginCli
  .command('whoami', 'Show current authenticated user')
  .action(async (_options, { console: output, process: proc }) => {
    const config = await import('./config.ts').then((m) => m.loadConfig())
    if (!config.sessionToken) {
      output.log('Not logged in. Run `holocron login` first.')
      return proc.exit(1)
    }
    const baseUrl = config.baseUrl || 'https://holocron.so'
    const res = await fetch(new URL('/api/auth/get-session', baseUrl), {
      headers: { Authorization: `Bearer ${config.sessionToken}` },
    })
    if (!res.ok) {
      output.log('Session expired or invalid. Run `holocron login` again.')
      return proc.exit(1)
    }
    const session = await readJson<{ user?: { name?: string; email?: string } }>(res)
    output.log(`Logged in as ${session.user?.name || 'unknown'} (${session.user?.email || 'unknown'})`)
    output.log(`Server: ${baseUrl}`)
  })

async function readJson<T>(response: Response): Promise<T> {
  return (await response.json()) as T
}
