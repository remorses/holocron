import {
    deployFly,
    getCurrentStage,
    getDopplerEnv,
    shell,
} from '@xmorse/deployment-utils'
import { qstash } from 'website/src/lib/qstash'
import { app } from 'website/src/lib/spiceflow'
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
    await shell(`pnpm react-router typegen`)
    await Promise.all([
        shell(`pnpm build`, {
            env,
        }),
        shell(`pnpm tsc --incremental`, {
            env,
        }),
    ])

    await qstash.schedules.create({
        destination: new URL(
            app.safePath('/api/databaseNightlyCleanup'),
            env.PUBLIC_URL,
        ).toString(),
        cron: '*/10 * * * *',
        scheduleId: 'nightly-page-blobs-cleanup',
        method: 'POST',
        body: JSON.stringify({ SERVICE_SECRET: env.SERVICE_SECRET }),
    })

    const port = 7664
    await deployFly({
        appName: 'holocron-website-prod',
        port,
        buildRemotely: true,
        dockerfile: 'Dockerfile',
        minInstances: 1,
        forceHttps: false,
        maxInstances: 1,
        kill_timeout: 300,
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
