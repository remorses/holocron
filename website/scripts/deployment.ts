import { deployFly, getCurrentStage, getDopplerEnv, shell } from '@xmorse/deployment-utils'
import { qstash } from 'website/src/lib/qstash'
import { app } from 'website/src/lib/spiceflow'
// import './openapi'

async function main() {
  const stage = getCurrentStage()
  const isProduction = stage === 'production'

  if (stage !== 'production' && stage !== 'preview') {
    console.warn(`skipping deployment because stage is ${stage}. Only production and preview are supported.`)
    return
  }

  const env = await getDopplerEnv({ stage, project: 'website' })
  env.FORCE_COLOR = '1'
  await shell(`pnpm react-router typegen`)
  await Promise.all([
    shell(`pnpm build`, {
      env,
    }),
    shell(`pnpm tsc --incremental`, {
      env,
    }),
  ])

  if (isProduction) {
    await qstash.schedules.create({
      destination: new URL(app.safePath('/api/databaseNightlyCleanup'), env.PUBLIC_URL).toString(),
      cron: '*/10 * * * *',
      scheduleId: 'nightly-page-blobs-cleanup',
      method: 'POST',
      body: JSON.stringify({ SERVICE_SECRET: env.SERVICE_SECRET }),
    })
  }

  const port = 7664
  const appName = stage === 'production' ? 'fumabase-website-prod' : 'fumabase-website-preview'

  await deployFly({
    appName,
    port,
    buildRemotely: true,
    // buildkit: true,
    dockerfile: 'Dockerfile',
    minInstances: isProduction ? 1 : 0,
    forceHttps: false,
    maxInstances: 3,
    kill_timeout: 300,
    healthCheckPath: '/api/health',
    memorySize: '1gb',
    machineType: 'shared-cpu-2x',
    depot: true,
    // suspend: stage === 'preview',
    env: {
      ...env,
      NODE_ENV: 'production',
      PORT: String(port),
    },
    regions: [stage === 'preview' ? 'fra' : 'iad'],
  })
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
