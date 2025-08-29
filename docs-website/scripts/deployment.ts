import {
    deployFly,
    getCurrentStage,
    getDopplerEnv,
    shell,
} from '@xmorse/deployment-utils'
// import './openapi'

async function main() {
    const stage = getCurrentStage()
    if (stage !== 'production') {
        console.warn(
            `skipping depoyment because not in prod. staging currently not setup still`,
        )
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
        await shell(`pnpm tsc --incremental`, {
            env,
        }),
    ])

    const port = 7777

    const appNameSuffix = basePath ? `-base-path-${basePath.replace(/^\//, '').replace(/\//g, '-')}` : ''
    const appName = `fumabse-docs-prod${appNameSuffix}`

    await deployFly({
        appName,
        port,
        buildRemotely: true,
        dockerfile: 'Dockerfile',
        minInstances: 1,
        forceHttps: false,
        maxInstances: 3,
        healthCheckPath: `${basePath}/api/health`,
        memorySize: '1gb',
        machineType: 'shared-cpu-2x',
        depot: true,
        kill_timeout: 300,
        env: {
            ...env,
            NODE_ENV: 'production',
            PORT: String(port),
        },
        regions: ['iad'],
    })
}

main()
