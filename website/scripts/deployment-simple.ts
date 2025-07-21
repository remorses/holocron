import { deployFly, getDopplerEnv, shell } from '@xmorse/deployment-utils'

async function main() {
    const env = await getDopplerEnv({ stage: 'production', project: 'website' })
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

    // Skip qstash schedule creation for now to avoid import issues
    console.log('Skipping qstash schedule creation due to import issues')

    const port = 7664
    await deployFly({
        appName: 'fumabase-website-prod',
        port,
        buildRemotely: true,
        dockerfile: 'Dockerfile',
        minInstances: 1,
        forceHttps: false,
        maxInstances: 3,
        healthCheckPath: '/api/health',
        memorySize: '1gb',
        machineType: 'shared-cpu-2x',
        depot: true,

        env: {
            ...env,
            NODE_ENV: 'production',
            PORT: String(port),
        },
        regions: ['iad'],
    })
}

main()
