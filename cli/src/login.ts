// Login command — authenticates with holocron.so via BetterAuth device flow.
// Opens the browser for the user to approve, polls until approved, saves the token.

import * as clack from '@clack/prompts'
import { goke, openInBrowser } from 'goke'
import { getBaseUrl, saveConfig } from './config.ts'

export const loginCli = goke()

const CLI_CLIENT_ID = 'holocron-cli'

async function readJson<T>(response: Response): Promise<T> {
  return await response.json() as T
}

loginCli
  .command('login', 'Authenticate with Holocron via browser login')
  .option('-u, --url [url]', 'Holocron website URL (default: https://holocron.so)')
  .action(async (options, { process: proc }) => {
    const baseUrl = options.url || getBaseUrl()
    clack.intro('Holocron — Login')

    clack.log.info('Requesting device code...')
    const deviceRes = await fetch(new URL('/api/auth/device/code', baseUrl), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: CLI_CLIENT_ID }),
    })

    if (!deviceRes.ok) {
      const text = await deviceRes.text()
      clack.log.error(`Failed to request device code: ${deviceRes.status} ${text}`)
      return proc.exit(1)
    }

    const deviceData: {
      device_code: string
      user_code: string
      verification_uri: string
      verification_uri_complete: string
      expires_in: number
      interval: number
    } = await readJson(deviceRes)

    const verificationUrl = deviceData.verification_uri_complete ||
      `${baseUrl}${deviceData.verification_uri}?user_code=${deviceData.user_code}`

    clack.log.info(`Your code: ${deviceData.user_code}`)
    clack.log.info('Opening browser to approve...')
    void openInBrowser(verificationUrl)

    const spinner = clack.spinner()
    spinner.start('Waiting for approval...')

    const pollInterval = (deviceData.interval || 5) * 1000
    const deadline = Date.now() + (deviceData.expires_in || 300) * 1000

    while (Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, pollInterval))

      const pollRes = await fetch(new URL('/api/auth/device/token', baseUrl), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
          device_code: deviceData.device_code,
          client_id: CLI_CLIENT_ID,
        }),
      })

      if (pollRes.ok) {
        const result = await readJson<{ access_token?: string }>(pollRes)
        const token = result.access_token
        if (token) {
          spinner.stop('Approved!')
          saveConfig({ sessionToken: token, baseUrl })
          clack.log.success(`Logged in to ${baseUrl}`)
          clack.outro('Done')
          return
        }
      }

      const pollBody = await readJson<{ error?: string }>(pollRes).catch((): { error?: string } => ({}))
      if (pollBody.error === 'expired_token') {
        spinner.stop('Code expired')
        clack.log.error('Device code expired. Run `holocron login` again.')
        return proc.exit(1)
      }
      if (pollBody.error === 'access_denied') {
        spinner.stop('Denied')
        clack.log.error('Login was denied.')
        return proc.exit(1)
      }
      // authorization_pending or slow_down — keep polling
    }

    spinner.stop('Timed out')
    clack.log.error('Login timed out. Run `holocron login` again.')
    return proc.exit(1)
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
