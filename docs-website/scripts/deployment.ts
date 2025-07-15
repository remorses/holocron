import { deployFly, getDopplerEnv, shell } from '@xmorse/deployment-utils'
// import './openapi'

async function main() {
    // const stage = getCurrentStage()
    let env: Record<string, string>
    try {
        env = getDopplerEnv({ stage: 'production', project: 'website' })
    } catch (error) {
        console.log('Production environment not available, trying preview...')
        try {
            env = getDopplerEnv({ stage: 'preview', project: 'website' })
        } catch (previewError) {
            console.log(
                'Preview environment not available, skipping deployment',
            )
            return
        }
    }
    env.FORCE_COLOR = '1'
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
    await deployFly({
        appName: 'fumabase-docs-prod',
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
