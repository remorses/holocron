// Login command — authenticates with holocron.so via BetterAuth device flow.
// Interactive users get the clack spinner UX via loginWithDeviceFlow().
// Agents use a background daemon so they get immediate control back.

import { goke, isAgent, openInBrowser } from 'goke'
import { stringify } from 'yaml'
import { getBaseUrl, setServerAuth, clearServerAuth, getSessionToken, normalizeUrl, loginHint } from './config.ts'
import { loginWithDeviceFlow, requestDeviceCode, buildVerificationUrl, CLI_CLIENT_ID } from './device-flow.ts'
import { getApiClient } from './api-client.ts'
import { logger, colors } from './logger.ts'

export const loginCli = goke()

loginCli
  .command('login', 'Authenticate with Holocron via browser login')
  .action(async (_options, ctx) => {
    const { console: output, process: proc } = ctx
    const baseUrl = getBaseUrl()

    if (ctx.daemon.isDaemon) {
      // ── DAEMON: poll until user approves in browser ──
      const deviceCode = proc.env.HOLOCRON_DEVICE_CODE
      if (!deviceCode) {
        output.error(logger.error('Missing HOLOCRON_DEVICE_CODE for login daemon'))
        proc.exit(1)
        return
      }
      const pollInterval = Number(proc.env.HOLOCRON_POLL_INTERVAL || 5) * 1000
      const expiresIn = Number(proc.env.HOLOCRON_DEVICE_EXPIRES_IN || 300)
      const deadline = Date.now() + expiresIn * 1000

      while (Date.now() < deadline) {
        await new Promise((r) => { setTimeout(r, pollInterval) })

        const pollRes = await fetch(new URL('/api/auth/device/token', baseUrl), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
            device_code: deviceCode,
            client_id: CLI_CLIENT_ID,
          }),
        })

        const pollBody = await pollRes.json() as { access_token?: string; error?: string }

        if (pollRes.ok && pollBody.access_token) {
          setServerAuth(baseUrl, pollBody.access_token)
          return
        }

        if (pollBody.error === 'expired_token') {
          output.error(logger.error('Device code expired.'))
          proc.exit(1)
          return
        }
        if (pollBody.error === 'access_denied') {
          output.error(logger.error('Login was denied.'))
          proc.exit(1)
          return
        }
        // authorization_pending or slow_down — keep polling
      }
      output.error(logger.error('Login timed out.'))
      proc.exit(1)
      return
    }

    // ── FOREGROUND: agent vs interactive ──

    if (isAgent) {
      // Request device code, start daemon, return immediately.
      output.log(logger.step('Requesting device code...'))
      const deviceData = await requestDeviceCode(baseUrl)
      const verificationUrl = buildVerificationUrl(baseUrl, deviceData)

      output.log(logger.step(`Your code: ${deviceData.user_code}`))
      output.log(logger.step(`Open: ${verificationUrl}`))
      await openInBrowser(verificationUrl)

      const expiresIn = deviceData.expires_in || 300
      await ctx.daemon.start({
        timeoutMs: expiresIn * 1000,
        env: {
          HOLOCRON_DEVICE_CODE: deviceData.device_code,
          HOLOCRON_POLL_INTERVAL: String(deviceData.interval || 5),
          HOLOCRON_DEVICE_EXPIRES_IN: String(expiresIn),
        },
      })
      output.log(logger.step('Login running in background.'))
      output.log(logger.step('After approving in browser, verify with: holocron whoami'))
      return
    }

    // Interactive: use the clack-based device flow directly (nice spinner UX)
    const result = await loginWithDeviceFlow({
      baseUrl,
      exit: (code) => proc.exit(code),
    })

    setServerAuth(baseUrl, result.accessToken)
    output.log(logger.success(`Logged in to ${colors.bold(baseUrl)}`))
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
  .action(async (_options, ctx) => {
    const { console: output, process: proc } = ctx
    const baseUrl = normalizeUrl(getBaseUrl())
    const sessionToken = getSessionToken(baseUrl)
    if (!sessionToken) {
      // Check if login daemon is still running
      const loginDaemon = ctx.daemon.forCommand('login')
      if (await loginDaemon.isRunning()) {
        output.error(logger.error('Login in progress. Approve in browser first.'))
        return proc.exit(1)
      }
      output.error(logger.error(`Not logged in. Run ${loginHint(baseUrl)} first.`))
      return proc.exit(1)
    }

    const { safeFetch } = getApiClient()
    const res = await safeFetch('/api/v0/me')
    if (res instanceof Error) {
      output.error(logger.error(`Session expired or invalid. Run ${loginHint(baseUrl)} again.`))
      return proc.exit(1)
    }

    // `user` is null only for API-key auth; `login` always uses a session token.
    if (!res.user) {
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
