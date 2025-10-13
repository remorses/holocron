import { deployFly, getCurrentStage, getDopplerEnv, shell } from '@xmorse/deployment-utils'
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

  const basePath = process.env.PUBLIC_BASE_PATH || ''
  if (basePath) {
    env.PUBLIC_BASE_PATH = basePath
  }

  await shell(`pnpm react-router typegen`)
  await Promise.all([
    shell(`pnpm build`, {
      env,
    }),
    shell(`pnpm tsc`, {
      env: { ...env, NODE_OPTIONS: '--max-old-space-size=6144' },
    }),
  ])

  const port = 7777

  const appNameSuffix = basePath ? `-base-path-${basePath.replace(/^\//, '').replace(/\//g, '-')}` : ''
  const stagePrefix = stage === 'production' ? 'prod' : 'preview'
  const appName = `fumabase-docs-${stagePrefix}${appNameSuffix}`

  await deployFly({
    appName,
    port,
    buildRemotely: true,
    dockerfile: 'Dockerfile',
    minInstances: stage === 'production' ? 1 : 1,
    forceHttps: false,
    maxInstances: stage === 'production' ? 3 : 1,
    healthCheckPath: `${basePath}/api/health`,
    buildkit: true,

    memorySize: '1gb',
    machineType: 'shared-cpu-2x',
    // suspend: stage === 'preview',
    depot: true,
    kill_timeout: 300,
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
