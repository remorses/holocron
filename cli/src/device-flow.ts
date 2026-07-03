// Reusable device flow login for CLI (@holocron.so/cli create, login).
// Opens the browser for the user to approve, polls until approved,
// returns the access token. Does NOT save config — the caller decides
// where to store the token.

import * as clack from '@clack/prompts'
import { openInBrowser } from 'goke'

export const CLI_CLIENT_ID = 'holocron-cli'

async function readJson<T>(response: Response): Promise<T> {
  return (await response.json()) as T
}

export interface DeviceCodeData {
  device_code: string
  user_code: string
  verification_uri: string
  verification_uri_complete: string
  expires_in: number
  interval: number
}

export interface DeviceFlowResult {
  accessToken: string
}

/** Request a device code from the BetterAuth device flow endpoint. */
export async function requestDeviceCode(baseUrl: string): Promise<DeviceCodeData> {
  const deviceRes = await fetch(new URL('/api/auth/device/code', baseUrl), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: CLI_CLIENT_ID }),
  })

  if (!deviceRes.ok) {
    const text = await deviceRes.text()
    throw new Error(`Failed to request device code: ${deviceRes.status} ${text}`)
  }

  return readJson<DeviceCodeData>(deviceRes)
}

/** Build the verification URL from device code data. */
export function buildVerificationUrl(baseUrl: string, deviceData: DeviceCodeData): string {
  return deviceData.verification_uri_complete ||
    `${baseUrl}${deviceData.verification_uri}?user_code=${deviceData.user_code}`
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
  let deviceData: DeviceCodeData
  try {
    deviceData = await requestDeviceCode(baseUrl)
  } catch (err) {
    clack.log.error(err instanceof Error ? err.message : String(err))
    exit(1)
    throw err
  }

  const verificationUrl = buildVerificationUrl(baseUrl, deviceData)

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

    // Read the body exactly once — Response.body can only be consumed once.
    const pollBody = await readJson<{ access_token?: string; error?: string }>(pollRes)

    if (pollRes.ok && pollBody.access_token) {
      spinner.stop('Approved!')
      return { accessToken: pollBody.access_token }
    }

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
