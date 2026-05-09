// Reusable device flow login for CLI (@holocron.so/cli create).
// Opens the browser for the user to approve, polls until approved,
// returns the access token. Does NOT save config — the caller decides
// where to store the token.

import * as clack from '@clack/prompts'
import { openInBrowser } from 'goke'

const CLI_CLIENT_ID = 'holocron-cli'

async function readJson<T>(response: Response): Promise<T> {
  return (await response.json()) as T
}

export interface DeviceFlowResult {
  accessToken: string
}

/**
 * Run the BetterAuth device flow against holocron.so (or a custom base URL).
 * Opens the browser, polls for approval, and returns the access token.
 * Throws on timeout, denial, or network error.
 */
export async function loginWithDeviceFlow(options: {
  baseUrl: string
  /** Called when the process needs to exit (e.g. user denied). */
  exit: (code: number) => void
}): Promise<DeviceFlowResult> {
  const { baseUrl, exit } = options

  clack.log.info('Requesting device code...')
  const deviceRes = await fetch(new URL('/api/auth/device/code', baseUrl), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: CLI_CLIENT_ID }),
  })

  if (!deviceRes.ok) {
    const text = await deviceRes.text()
    clack.log.error(`Failed to request device code: ${deviceRes.status} ${text}`)
    exit(1)
    throw new Error('device code request failed')
  }

  const deviceData: {
    device_code: string
    user_code: string
    verification_uri: string
    verification_uri_complete: string
    expires_in: number
    interval: number
  } = await readJson(deviceRes)

  const verificationUrl =
    deviceData.verification_uri_complete ||
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
      if (result.access_token) {
        spinner.stop('Approved!')
        return { accessToken: result.access_token }
      }
    }

    const pollBody = await readJson<{ error?: string }>(pollRes).catch(
      (): { error?: string } => ({}),
    )
    if (pollBody.error === 'expired_token') {
      spinner.stop('Code expired')
      clack.log.error('Device code expired. Try again.')
      exit(1)
      throw new Error('device code expired')
    }
    if (pollBody.error === 'access_denied') {
      spinner.stop('Denied')
      clack.log.error('Login was denied.')
      exit(1)
      throw new Error('login denied')
    }
    // authorization_pending or slow_down — keep polling
  }

  spinner.stop('Timed out')
  clack.log.error('Login timed out. Try again.')
  exit(1)
  throw new Error('login timed out')
}
