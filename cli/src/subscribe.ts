// Subscribe command — creates a Stripe Checkout session for a project and opens
// the browser so the user can complete payment. If the project already has an
// active subscription, opens the billing portal instead.
//
// Also provides `subscription status` to check the current subscription state.

import * as clack from '@clack/prompts'
import { goke, isAgent, openInBrowser } from 'goke'
import { getApiClient, getManagementClient } from './api-client.ts'
import { logger, colors } from './logger.ts'

export const subscribeCli = goke()

/** Prompt for a project selection or fail with usage hint in non-interactive mode. */
async function resolveProject(opts: {
  projectId: string | undefined
  safeFetch: ReturnType<typeof getApiClient>['safeFetch']
  output: { log: (...args: any[]) => void; error: (...args: any[]) => void }
  exit: (code: number) => void
}): Promise<string | undefined> {
  if (opts.projectId) return opts.projectId

  const nonInteractive = isAgent || !process.stdin.isTTY
  if (nonInteractive) {
    opts.output.error(logger.error('Missing --project. Usage: holocron <command> --project <projectId>'))
    opts.exit(1)
    return undefined
  }

  const projectsRes = await opts.safeFetch('/api/v0/projects')
  if (projectsRes instanceof Error) {
    opts.output.error(logger.error(`Failed to list projects: ${projectsRes.message}`))
    opts.exit(1)
    return undefined
  }

  if (projectsRes.projects.length === 0) {
    opts.output.error(logger.error('No projects found. Create one first with `holocron projects create --name "My Docs"`.'))
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

subscribeCli
  .command('subscribe', 'Subscribe a project to Holocron Pro')
  .option('--project [projectId]', 'Project ID to subscribe')
  .option('--interval [interval]', 'Billing interval: monthly or yearly (default: monthly)')
  .action(async (options, { console: output, process: proc }) => {
    const { safeFetch } = getApiClient()
    const nonInteractive = isAgent || !process.stdin.isTTY

    const projectId = await resolveProject({
      projectId: options.project,
      safeFetch,
      output,
      exit: (code) => proc.exit(code),
    })
    if (!projectId) return proc.exit(1)

    // Resolve interval
    let interval = options.interval
    if (interval && interval !== 'monthly' && interval !== 'yearly') {
      output.error(logger.error(`Invalid interval "${interval}". Must be "monthly" or "yearly".`))
      return proc.exit(1)
    }

    if (!interval) {
      if (nonInteractive) {
        interval = 'monthly'
      } else {
        const selected = await clack.select({
          message: 'Billing interval:',
          options: [
            { value: 'monthly', label: 'Monthly' },
            { value: 'yearly', label: 'Yearly', hint: 'save ~20%' },
          ],
        })
        if (clack.isCancel(selected)) return proc.exit(1)
        interval = selected as string
      }
    }

    output.log(logger.step('Creating checkout session...'))

    const res = await safeFetch('/api/v0/subscriptions/checkout', {
      method: 'POST',
      body: { projectId, interval: interval as 'monthly' | 'yearly' },
    })
    if (res instanceof Error) {
      output.error(logger.error(`Failed to create checkout: ${res.message}`))
      return proc.exit(1)
    }

    if (res.alreadySubscribed) {
      output.log(logger.info('Project already has an active subscription. Opening billing portal...'))
    } else {
      output.log(logger.success('Checkout session created.'))
    }

    // In TTY, open browser. In non-TTY, just print the URL for the caller.
    if (process.stdout.isTTY) {
      await openInBrowser(res.url)
    }

    output.log('')
    output.log(`  ${colors.dim('URL:')} ${res.url}`)

    if (!res.alreadySubscribed) {
      output.log('')
      output.log('Complete the checkout in your browser to activate the subscription.')
    }
  })

subscribeCli
  .command('subscription status', 'Check subscription status for a project')
  .option('--project [projectId]', 'Project ID to check')
  .action(async (options, { console: output, process: proc }) => {
    const { safeFetch } = getManagementClient()

    const projectId = await resolveProject({
      projectId: options.project,
      safeFetch,
      output,
      exit: (code) => proc.exit(code),
    })
    if (!projectId) return proc.exit(1)

    const res = await safeFetch('/api/v0/subscriptions/:projectId', {
      params: { projectId },
    })
    if (res instanceof Error) {
      output.error(logger.error(`Failed to check subscription: ${res.message}`))
      return proc.exit(1)
    }

    const sub = res.subscription
    if (!sub) {
      output.log(logger.info('No active subscription for this project.'))
      output.log('')
      output.log(`Subscribe with: ${colors.dim('holocron subscribe --project')} ${projectId}`)
      return
    }

    output.log(logger.success('Active subscription found'))
    output.log('')
    output.log(`  Status:          ${colors.green(sub.status)}`)
    output.log(`  Interval:        ${sub.interval || 'unknown'}`)
    output.log(`  Period ends:     ${sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd).toISOString().slice(0, 10) : 'unknown'}`)
    output.log(`  Cancel at end:   ${sub.cancelAtPeriodEnd ? colors.yellow('yes') : 'no'}`)
    output.log(`  Subscription ID: ${colors.dim(sub.subscriptionId)}`)
  })
