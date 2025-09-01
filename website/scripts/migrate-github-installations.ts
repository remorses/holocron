import { prisma } from 'db'
import pg from 'pg'
import { getGithubApp } from '../src/lib/github.server.js'
import { env } from '../src/lib/env.js'

const { Client } = pg

let dryRun = false

async function checkInstallationActive(installationId: number): Promise<boolean> {
    try {
        const app = getGithubApp()

        // Try to get the installation - this will fail if it's suspended or deleted
        const installation = await app.octokit.rest.apps.getInstallation({
            installation_id: installationId,
        })

        console.log(`✓ Installation ${installationId} is active (account: ${installation.data.account && 'login' in installation.data.account ? installation.data.account.login : installation.data.account?.name})`)
        return true
    } catch (error: any) {
        if (error.status === 404) {
            console.log(`✗ Installation ${installationId} not found (404)`)
            return false
        }
        if (error.status === 403 && error.message?.includes('suspended')) {
            console.log(`✗ Installation ${installationId} is suspended`)
            return false
        }
        console.error(`✗ Error checking installation ${installationId}: ${error.message}`)
        return false
    }
}

async function migrateGithubInstallations() {
    const holocronClient = new Client({
        connectionString: process.env.HOLOCRON_DATABASE_URL,
    })

    try {
        await holocronClient.connect()
        console.log('Connected to Holocron database')
        console.log(`Running in ${dryRun ? 'DRY RUN' : 'LIVE'} mode\n`)

        const existingInstallations = await prisma.githubInstallation.findMany({
            select: { installationId: true, appId: true },
        })
        const existingSet = new Set(
            existingInstallations.map((i) => `${i.installationId}-${i.appId}`),
        )

        const installations = await holocronClient.query(`
            SELECT
                "installationId",
                "accountLogin",
                "accountAvatarUrl",
                "accountType",
                "oauthToken",
                status,
                "createdAt"
            FROM public."GithubInstallation"
            ORDER BY "createdAt" DESC
        `)

        console.log(
            `Found ${installations.rows.length} GitHub installations in old database\n`,
        )

        const seenInstallations = new Set<number>()
        let migratedCount = 0
        let skippedInactive = 0

        for (const installation of installations.rows) {
            // Skip duplicate installations (keep only the most recent due to ORDER BY)
            if (seenInstallations.has(installation.installationId)) {
                console.log(
                    `Skipping duplicate installation ${installation.installationId}`,
                )
                continue
            }
            seenInstallations.add(installation.installationId)

            const key = `${installation.installationId}-${env.GITHUB_APP_ID}`

            if (existingSet.has(key)) {
                console.log(`Skipping existing installation: ${key}`)
                continue
            }

            console.log(
                `\nChecking installation ${installation.installationId} for ${installation.accountLogin}...`,
            )

            // Check if installation is still active on GitHub
            const isActive = await checkInstallationActive(installation.installationId)

            if (!isActive) {
                console.log(`→ Skipping inactive/suspended installation`)
                skippedInactive++
                continue
            }

            console.log(`→ Migrating active installation`)

            if (!dryRun) {
                await prisma.githubInstallation.create({
                    data: {
                        installationId: installation.installationId,
                        accountLogin: installation.accountLogin || '',
                        appId: env.GITHUB_APP_ID!,
                        accountAvatarUrl: installation.accountAvatarUrl || '',
                        accountType: installation.accountType || 'USER',
                        oauthToken: installation.oauthToken,
                        status: 'active', // We verified it's active
                        memberLogins: [],
                    },
                })
            }

            migratedCount++
        }

        console.log(`\n${'='.repeat(50)}`)
        console.log(`Migration completed successfully!`)
        console.log(`Migrated: ${migratedCount} GitHub installations`)
        console.log(`Skipped inactive/suspended: ${skippedInactive}`)
        if (dryRun) {
            console.log(`\n⚠️  This was a dry run. Run without --dry-run to actually migrate.`)
        }
        console.log(
            `\nNote: Org and Site relationships need to be created manually`,
        )
        console.log(`since the IDs don't match between old and new databases.`)
    } catch (error) {
        console.error('Migration failed:', error)
        throw error
    } finally {
        await holocronClient.end()
    }
}

migrateGithubInstallations()
    .catch(console.error)
    .finally(async () => {
        await prisma.$disconnect()
    })
