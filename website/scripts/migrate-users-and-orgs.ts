import { prisma } from 'db'
import pg from 'pg'
import { env } from '../src/lib/env.js'
import { ulid } from 'ulid'

const { Client } = pg

let dryRun = false

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

        // Fetch all existing GitHub installations from new database upfront
        console.log('\nFetching existing GitHub installations from new database...')
        console.time('fetch-new-github-installations')
        const existingGithubInstallations = await prisma.githubInstallation.findMany({
            where: {
                appId: env.GITHUB_APP_ID!
            },
            select: {
                installationId: true,
                appId: true
            }
        })
        console.timeEnd('fetch-new-github-installations')
        console.log(`Found ${existingGithubInstallations.length} GitHub installations in new database`)

        // Create a Set for fast lookups
        const existingInstallationIds = new Set(
            existingGithubInstallations.map(inst => inst.installationId)
        )

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

        // Map shared orgs to first admin user's personal org
        const sharedOrgMappings = new Map<string, string>()
        for (const [oldOrgId, members] of oldOrgMembers.entries()) {
            if (members.size > 1) {
                // Find the first admin user for this org
                for (const userId of members) {
                    const orgRel = oldOrgsUsersResult.rows.find(
                        r => r.userId === userId && r.orgId === oldOrgId && r.role === 'ADMIN'
                    )
                    if (orgRel) {
                        sharedOrgMappings.set(oldOrgId, userId)
                        console.log(`\nShared org ${oldOrgId} with ${members.size} members will map to first admin user ${userId}`)
                        break
                    }
                }
                // If no admin found, use first member
                if (!sharedOrgMappings.has(oldOrgId)) {
                    const firstUserId = Array.from(members)[0]
                    sharedOrgMappings.set(oldOrgId, firstUserId)
                    console.log(`\nShared org ${oldOrgId} with ${members.size} members will map to first member ${firstUserId} (no admin found)`)
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
                console.log(`Found existing user: ${oldUser.email}`)

                // Get the existing user and their orgs
                const existingUser = await prisma.user.findUnique({
                    where: { email: oldUser.email },
                    include: {
                        orgs: true
                    }
                })

                if (existingUser) {
                    oldToNewUserIdMap.set(oldUser.id, existingUser.id)

                    // Since user ID = org ID, use the user's ID as their personal org
                    const personalOrgId = existingUser.id
                    console.log(`  → Using user's org (same as user ID): ${personalOrgId}`)

                    // Map old orgs to existing personal org
                    const userOrgs = userOrgRelationships.get(oldUser.id) || []
                    for (const orgRel of userOrgs) {
                        const orgMembers = oldOrgMembers.get(orgRel.orgId)
                        if (orgMembers) {
                            if (orgMembers.size === 1) {
                                // Single-member org
                                if (!oldToNewOrgIdMap.has(orgRel.orgId)) {
                                    oldToNewOrgIdMap.set(orgRel.orgId, personalOrgId)
                                    console.log(`  → Mapped old personal org ${orgRel.orgId} to existing org ${personalOrgId}`)
                                }
                            } else {
                                // Multi-member org - check if this user is the designated owner
                                const designatedOwner = sharedOrgMappings.get(orgRel.orgId)
                                if (designatedOwner === oldUser.id) {
                                    if (!oldToNewOrgIdMap.has(orgRel.orgId)) {
                                        oldToNewOrgIdMap.set(orgRel.orgId, personalOrgId)
                                        console.log(`  → Mapped shared org ${orgRel.orgId} to existing org ${personalOrgId} (designated owner)`)
                                    }
                                }
                            }
                        }
                    }
                }
                continue
            }

            const userMetadata = oldUser.raw_user_meta_data || {}

            // Generate new user ID (same ID will be used for personal org)
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

            // Create a personal org for the user (using same ID as user)
            const personalOrgId = newUserId
            console.log(`  → Creating personal org with same ID as user: ${personalOrgId}`)

            if (!dryRun) {
                try {
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
                } catch (error: any) {
                    if (error.code === 'P2002') {
                        console.error(`  ✗ Personal org ${personalOrgId} already exists (this should be extremely rare)`)
                    } else {
                        throw error
                    }
                }
            }

            // Map old orgs to the new personal org
            const userOrgs = userOrgRelationships.get(oldUser.id) || []

            for (const orgRel of userOrgs) {
                const orgMembers = oldOrgMembers.get(orgRel.orgId)
                if (orgMembers) {
                    if (orgMembers.size === 1) {
                        // Single-member org - map to personal org
                        if (!oldToNewOrgIdMap.has(orgRel.orgId)) {
                            oldToNewOrgIdMap.set(orgRel.orgId, personalOrgId)
                            console.log(`  → Mapped old personal org ${orgRel.orgId} to new personal org ${personalOrgId}`)
                        }
                    } else {
                        // Multi-member org - check if this user is the designated owner
                        const designatedOwner = sharedOrgMappings.get(orgRel.orgId)
                        if (designatedOwner === oldUser.id) {
                            if (!oldToNewOrgIdMap.has(orgRel.orgId)) {
                                oldToNewOrgIdMap.set(orgRel.orgId, personalOrgId)
                                console.log(`  → Mapped shared org ${orgRel.orgId} to this user's personal org ${personalOrgId} (designated owner)`)
                            }
                        }
                    }
                }
            }
        }

        // No longer creating shared orgs - they are mapped to personal orgs of designated owners

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
                if (existingInstallationIds.has(inst.installationId)) {
                    // Find the user email for this org (since orgId = userId)
                    let userEmail = 'unknown'
                    // First check if it's a direct user ID mapping
                    const userEntry = Array.from(oldToNewUserIdMap.entries()).find(([_, newId]) => newId === newOrgId)
                    if (userEntry) {
                        const oldUserId = userEntry[0]
                        const oldUser = oldUsersResult.rows.find(u => u.id === oldUserId)
                        if (oldUser?.email) {
                            userEmail = oldUser.email
                        }
                    }

                    console.log(`\nConnecting GitHub installation ${inst.installationId} (${inst.accountLogin}) to org ${newOrgId} (user: ${userEmail})`)

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
