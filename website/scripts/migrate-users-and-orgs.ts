import { prisma } from 'db'
import pg from 'pg'
import { env } from '../src/lib/env.js'
import { ulid } from 'ulid'

const { Client } = pg

let dryRun = true

interface OldUser {
    id: string
    email: string | null
    raw_user_meta_data: any
    created_at: Date
    updated_at: Date
    email_confirmed_at: Date | null
}


interface OldOrgsUsers {
    userId: string
    orgId: string
    role: string
    guestSiteIds: string[]
}

interface OldGithubInstallation {
    installationId: number
    accountLogin: string
    accountAvatarUrl: string
    accountType: string
    createdAt: Date
    orgId: string
    appId: string | null
    oauthToken: string | null
    status: string
}

async function migrateUsersAndOrgs() {
    const holocronClient = new Client({
        connectionString: process.env.HOLOCRON_DATABASE_URL,
    })

    try {
        await holocronClient.connect()
        console.log('Connected to Holocron database')
        console.log(`Running in ${dryRun ? 'DRY RUN' : 'LIVE'} mode\n`)

        // Get existing users to avoid duplicates
        console.log('Fetching existing users from new database...')
        console.time('fetch-existing-users')
        const existingUsers = await prisma.user.findMany({
            select: { email: true },
        })
        const existingEmailsSet = new Set(existingUsers.map(u => u.email))
        console.timeEnd('fetch-existing-users')
        console.log(`Found ${existingUsers.length} existing users in new database`)

        // Get existing orgs to track what we've already migrated
        console.log('\nFetching existing orgs from new database...')
        console.time('fetch-existing-orgs')
        const existingOrgs = await prisma.org.findMany({
            select: { orgId: true },
        })
        const existingOrgIds = new Set(existingOrgs.map(o => o.orgId))
        console.timeEnd('fetch-existing-orgs')
        console.log(`Found ${existingOrgs.length} existing orgs in new database`)

        // Fetch users from old database
        console.log('\nFetching users from old database...')
        console.time('fetch-old-users')
        const oldUsersResult = await holocronClient.query<OldUser>(`
            SELECT
                id,
                email,
                raw_user_meta_data,
                created_at,
                updated_at,
                email_confirmed_at
            FROM auth.users
            WHERE deleted_at IS NULL
            AND is_anonymous = false
            ORDER BY created_at ASC
        `)
        console.timeEnd('fetch-old-users')
        console.log(`Found ${oldUsersResult.rows.length} users in old database`)
        console.log(`  - ${oldUsersResult.rows.filter(u => u.email).length} users with email`)
        console.log(`  - ${oldUsersResult.rows.filter(u => !u.email).length} users without email`)
        console.log(`  - ${oldUsersResult.rows.filter(u => u.email_confirmed_at).length} users with verified email`)


        // Fetch old org relationships
        console.log('\nFetching org relationships from old database...')
        console.time('fetch-old-orgs-users')
        const oldOrgsUsersResult = await holocronClient.query<OldOrgsUsers>(`
            SELECT
                "userId",
                "orgId",
                role,
                "guestSiteIds"
            FROM public."OrgsUsers"
        `)
        console.timeEnd('fetch-old-orgs-users')
        console.log(`Found ${oldOrgsUsersResult.rows.length} org-user relationships`)

        // Group by userId to find users' org relationships (exclude GUEST users)
        const userOrgRelationships = new Map<string, OldOrgsUsers[]>()
        for (const rel of oldOrgsUsersResult.rows) {
            // Only consider ADMIN and MEMBER roles as actual org membership
            if (rel.role === 'ADMIN' || rel.role === 'MEMBER') {
                if (!userOrgRelationships.has(rel.userId)) {
                    userOrgRelationships.set(rel.userId, [])
                }
                userOrgRelationships.get(rel.userId)!.push(rel)
            }
        }
        console.log(`  - ${userOrgRelationships.size} unique users with org relationships (ADMIN/MEMBER only)`)

        // Count GUEST relationships that were excluded
        const guestRelationships = oldOrgsUsersResult.rows.filter(r => r.role === 'GUEST')
        console.log(`  - ${guestRelationships.length} GUEST relationships excluded`)

        // Count unique orgs
        const uniqueOldOrgs = new Set(oldOrgsUsersResult.rows.map(r => r.orgId))
        console.log(`  - ${uniqueOldOrgs.size} unique orgs (including those with only GUEST users)`)

        // Fetch old GitHub installations that were connected to orgs
        console.log('\nFetching GitHub installations from old database...')
        console.time('fetch-old-github-installations')
        const oldGithubInstallationsResult = await holocronClient.query<OldGithubInstallation>(`
            SELECT
                "installationId",
                "accountLogin",
                "accountAvatarUrl",
                "accountType",
                "createdAt",
                "orgId",
                "appId",
                "oauthToken",
                status
            FROM public."GithubInstallation"
        `)
        console.timeEnd('fetch-old-github-installations')
        console.log(`Found ${oldGithubInstallationsResult.rows.length} GitHub installations`)
        console.log(`  - ${oldGithubInstallationsResult.rows.filter(i => i.status === 'active').length} active installations`)
        console.log(`  - ${oldGithubInstallationsResult.rows.filter(i => i.status === 'suspended').length} suspended installations`)

        // Map installations by old orgId
        const installationsByOldOrgId = new Map<string, OldGithubInstallation[]>()
        for (const inst of oldGithubInstallationsResult.rows) {
            if (!installationsByOldOrgId.has(inst.orgId)) {
                installationsByOldOrgId.set(inst.orgId, [])
            }
            installationsByOldOrgId.get(inst.orgId)!.push(inst)
        }
        console.log(`  - ${installationsByOldOrgId.size} orgs have GitHub installations`)

        console.log('\n' + '='.repeat(50))
        console.log('Starting migration process...')
        console.log('='.repeat(50) + '\n')

        let migratedUsersCount = 0
        let migratedOrgsCount = 0
        let connectedInstallationsCount = 0
        let skippedUsersCount = 0

        // Map old user IDs to new user IDs for org connections
        const oldToNewUserIdMap = new Map<string, string>()
        // Map old org IDs to new org IDs - each old org gets a unique new org
        const oldToNewOrgIdMap = new Map<string, string>()
        // Track which users belong to which old orgs (for shared org migration)
        const oldOrgMembers = new Map<string, Set<string>>()

        // First pass: identify all unique old orgs and their members (exclude GUEST users)
        for (const rel of oldOrgsUsersResult.rows) {
            // Only consider ADMIN and MEMBER users as actual org members
            if (rel.role === 'ADMIN' || rel.role === 'MEMBER') {
                if (!oldOrgMembers.has(rel.orgId)) {
                    oldOrgMembers.set(rel.orgId, new Set())
                }
                oldOrgMembers.get(rel.orgId)!.add(rel.userId)
            }
        }

        // Pre-generate IDs for shared orgs that have GitHub installations
        const sharedOrgs = new Set<string>()
        for (const [oldOrgId, members] of oldOrgMembers.entries()) {
            if (members.size > 1) {
                // Check if this org has GitHub installations
                const hasInstallations = installationsByOldOrgId.has(oldOrgId) &&
                                        installationsByOldOrgId.get(oldOrgId)!.length > 0

                if (hasInstallations) {
                    sharedOrgs.add(oldOrgId)
                    const newOrgId = ulid()
                    oldToNewOrgIdMap.set(oldOrgId, newOrgId)

                    console.log(`\nPreparing shared org ${oldOrgId} → ${newOrgId} with ${members.size} members`)
                }
            }
        }

        // Build a set of users who have GitHub installations through their orgs
        const usersWithGithubInstallations = new Set<string>()
        for (const [oldOrgId, installations] of installationsByOldOrgId.entries()) {
            if (installations.length > 0) {
                const members = oldOrgMembers.get(oldOrgId)
                if (members) {
                    for (const userId of members) {
                        usersWithGithubInstallations.add(userId)
                    }
                }
            }
        }

        console.log(`Found ${usersWithGithubInstallations.size} users with GitHub installations\n`)

        // Migrate users (only those with GitHub installations)
        for (const oldUser of oldUsersResult.rows) {
            if (!oldUser.email) {
                console.log(`Skipping user ${oldUser.id} - no email`)
                skippedUsersCount++
                continue
            }

            // Skip users without GitHub installations
            if (!usersWithGithubInstallations.has(oldUser.id)) {
                // console.log(`Skipping user ${oldUser.email} - no GitHub installations`)
                skippedUsersCount++
                continue
            }

            if (existingEmailsSet.has(oldUser.email)) {
                console.log(`Skipping existing user: ${oldUser.email}`)

                // Still need to map the ID for org relationships
                const existingUser = await prisma.user.findUnique({
                    where: { email: oldUser.email }
                })
                if (existingUser) {
                    oldToNewUserIdMap.set(oldUser.id, existingUser.id)
                }
                continue
            }

            const userMetadata = oldUser.raw_user_meta_data || {}

            // Generate new user ID
            const newUserId = ulid()
            oldToNewUserIdMap.set(oldUser.id, newUserId)

            console.log(`\nMigrating user: ${oldUser.email}`)

            // Extract GitHub username from metadata if available
            const githubUsername = userMetadata.user_name || userMetadata.preferred_username || null

            if (!dryRun) {
                // Create the new user
                await prisma.user.create({
                    data: {
                        id: newUserId,
                        email: oldUser.email,
                        emailVerified: !!oldUser.email_confirmed_at,
                        name: userMetadata.full_name || userMetadata.name || oldUser.email.split('@')[0],
                        image: userMetadata.avatar_url || null,
                        createdAt: oldUser.created_at,
                        updatedAt: oldUser.updated_at,
                        twoFactorEnabled: false,
                        username: githubUsername,
                        signupReason: 'holocron-old-editor',
                    },
                })
                migratedUsersCount++
            }

            // Create a personal org for the user
            const personalOrgId = ulid()
            console.log(`  → Creating personal org: ${personalOrgId}`)

            if (!dryRun) {
                await prisma.org.create({
                    data: {
                        orgId: personalOrgId,
                        name: oldUser.email.split('@')[0] + "'s Org",
                        image: userMetadata.avatar_url || null,
                        createdAt: oldUser.created_at,
                        users: {
                            create: {
                                userId: newUserId,
                                role: 'ADMIN',
                            },
                        },
                    },
                })
                migratedOrgsCount++
            }

            // Map old single-member orgs to the new personal org
            const userOrgs = userOrgRelationships.get(oldUser.id) || []

            for (const orgRel of userOrgs) {
                // Check if this is a single-member org (personal org)
                const orgMembers = oldOrgMembers.get(orgRel.orgId)
                if (orgMembers && orgMembers.size === 1) {
                    // This is a personal org in the old system, map it to the new personal org
                    if (!oldToNewOrgIdMap.has(orgRel.orgId)) {
                        oldToNewOrgIdMap.set(orgRel.orgId, personalOrgId)
                        console.log(`  → Mapped old personal org ${orgRel.orgId} to new personal org ${personalOrgId}`)
                    }
                }
            }
        }

        // Now create shared orgs and add members
        for (const oldOrgId of sharedOrgs) {
            const members = oldOrgMembers.get(oldOrgId)!
            const newOrgId = oldToNewOrgIdMap.get(oldOrgId)!

            // Find the first migrated user to determine org details
            let orgName = `Shared Organization ${oldOrgId.slice(0, 8)}`
            let orgCreatedAt = new Date()

            for (const oldUserId of members) {
                const oldUser = oldUsersResult.rows.find(u => u.id === oldUserId)
                if (oldUser) {
                    orgCreatedAt = oldUser.created_at
                    const userMetadata = oldUser.raw_user_meta_data || {}
                    if (userMetadata.name) {
                        orgName = `${userMetadata.name}'s Team`
                        break
                    }
                }
            }

            console.log(`\nCreating shared org: ${newOrgId} (was ${oldOrgId})`)

            if (!dryRun) {
                // Create the shared org
                await prisma.org.create({
                    data: {
                        orgId: newOrgId,
                        name: orgName,
                        createdAt: orgCreatedAt,
                    },
                })
                migratedOrgsCount++

                // Add all members to the shared org (only those who were migrated)
                for (const oldUserId of members) {
                    const newUserId = oldToNewUserIdMap.get(oldUserId)
                    if (newUserId) {
                        const orgRel = oldOrgsUsersResult.rows.find(
                            r => r.userId === oldUserId && r.orgId === oldOrgId
                        )

                        await prisma.orgsUsers.create({
                            data: {
                                userId: newUserId,
                                orgId: newOrgId,
                                role: orgRel?.role === 'ADMIN' ? 'ADMIN' : 'MEMBER',
                            },
                        })

                        console.log(`  → Added user ${newUserId} as ${orgRel?.role || 'MEMBER'}`)
                    }
                }
            }
        }

        // Connect GitHub installations to orgs based on old org relationships
        console.log(`\n${'='.repeat(50)}`)
        console.log('Connecting GitHub installations to new orgs...')

        for (const [oldOrgId, installations] of installationsByOldOrgId.entries()) {
            const newOrgId = oldToNewOrgIdMap.get(oldOrgId)

            if (!newOrgId) {
                console.log(`\nNo mapping found for old org ${oldOrgId}, skipping ${installations.length} installations`)
                continue
            }

            for (const inst of installations) {
                // Check if this installation exists in the new database (already migrated)
                const existingInstallation = await prisma.githubInstallation.findUnique({
                    where: {
                        installationId_appId: {
                            installationId: inst.installationId,
                            appId: env.GITHUB_APP_ID!,
                        },
                    },
                })

                if (existingInstallation) {
                    console.log(`\nConnecting GitHub installation ${inst.installationId} (${inst.accountLogin}) to org ${newOrgId}`)

                    if (!dryRun) {
                        try {
                            // Create the org-github relationship
                            await prisma.orgGithubInstallation.create({
                                data: {
                                    installationId: inst.installationId,
                                    appId: env.GITHUB_APP_ID!,
                                    orgId: newOrgId,
                                },
                            })
                            connectedInstallationsCount++
                            console.log(`  ✓ Connected successfully`)
                        } catch (error: any) {
                            if (error.code === 'P2002') {
                                console.log(`  → Already connected`)
                            } else {
                                console.error(`  ✗ Error: ${error.message}`)
                            }
                        }
                    }
                } else {
                    console.log(`\n✗ GitHub installation ${inst.installationId} not found in new database (not migrated yet)`)
                }
            }
        }

        console.log(`\n${'='.repeat(50)}`)
        console.log(`Migration completed successfully!`)
        console.log(`Migrated users: ${migratedUsersCount}`)
        console.log(`Created orgs: ${migratedOrgsCount}`)
        console.log(`Connected GitHub installations: ${connectedInstallationsCount}`)
        console.log(`Skipped users: ${skippedUsersCount}`)

        if (dryRun) {
            console.log(`\n⚠️  This was a dry run. Run without --dry-run to actually migrate.`)
        }

        console.log(`\nNote: Sites and other relationships need to be migrated separately.`)

    } catch (error) {
        console.error('Migration failed:', error)
        throw error
    } finally {
        await holocronClient.end()
    }
}

migrateUsersAndOrgs()
    .catch(console.error)
    .finally(async () => {
        await prisma.$disconnect()
    })
