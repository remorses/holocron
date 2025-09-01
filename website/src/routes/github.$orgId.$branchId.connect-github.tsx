import { prisma, Prisma } from 'db'
import exampleDocs from 'website/scripts/example-docs.json'
import { redirect, type LoaderFunctionArgs, type ActionFunctionArgs, Form, useNavigation, useLoaderData } from 'react-router'
import * as cookie from 'cookie'
import { getSession } from '../lib/better-auth'
import { env } from '../lib/env'
import {
    getOctokit,
    createNewRepo,
    doesRepoExist,
} from '../lib/github.server'
import { defaultStartingHolocronJson } from 'docs-website/src/lib/docs-json-examples'
import type { DocsJsonType } from 'docs-website/src/lib/docs-json'
import { DOCS_JSON_BASENAME } from 'docs-website/src/lib/constants'
import { apiClient } from '../lib/spiceflow-client'
import { ulid } from 'ulid'
import { href } from 'react-router'
import type { Route } from './+types/github.$orgId.$branchId.connect-github'
import { GithubLoginRequestData } from '../lib/types'
import { GITHUB_LOGIN_DATA_COOKIE } from './api.github.webhooks'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { useState } from 'react'
const COOKIE_OPTIONS = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: 60 * 5, // 5 minutes
    path: '/',
}

export async function loader({ request, params }: Route.LoaderArgs) {
    const { userId, headers } = await getSession({ request })
    const { orgId, branchId } = params

    if (!userId) {
        throw new Response('Unauthorized', { status: 401 })
    }

    // Parse cookies
    const cookies = cookie.parse(request.headers.get('Cookie') || '')
    const githubDataStr = cookies[GITHUB_LOGIN_DATA_COOKIE]

    if (!githubDataStr) {
        throw new Response('Missing GitHub login data', { status: 400 })
    }

    const data: GithubLoginRequestData = JSON.parse(decodeURIComponent(githubDataStr))
    const githubAccountLogin = data.githubAccountLogin

    if (!githubAccountLogin) {
        throw new Response('Missing GitHub account login', { status: 400 })
    }

    // Get branch and check if already connected
    const branch = await prisma.siteBranch.findFirst({
        where: {
            branchId,
            site: {
                org: {
                    orgId,
                    users: { some: { userId } },
                },
            },
        },
        include: {
            site: true,
            domains: true,
        },
    })

    if (!branch) {
        throw new Response('Branch not found', { status: 404 })
    }

    const site = branch.site

    // If already connected to GitHub, create the installation connection and redirect
    if (site.githubOwner && site.githubRepo) {
        // Get the GitHub installation for this account
        const githubInstallation = await prisma.githubInstallation.findFirst({
            where: {
                orgs: {
                    some: {
                        orgId,
                        appId: env.GITHUB_APP_ID,
                    },
                },
                accountLogin: githubAccountLogin,
            },
        })

        if (!githubInstallation) {
            throw new Response('GitHub installation not found', { status: 404 })
        }

        // Create site-github connection
        await prisma.siteGithubInstallation.upsert({
            where: {
                installationId_appId_siteId: {
                    installationId: githubInstallation.installationId,
                    appId: env.GITHUB_APP_ID!,
                    siteId: site.siteId,
                },
            },
            create: {
                installationId: githubInstallation.installationId,
                appId: env.GITHUB_APP_ID!,
                siteId: site.siteId,
            },
            update: {},
        })

        // Clear GitHub data cookie
        const clearCookie = cookie.serialize(GITHUB_LOGIN_DATA_COOKIE, '', {
            ...COOKIE_OPTIONS,
            maxAge: 0,
        })


        const redirectUrl = href('/org/:orgId/branch/:branchId', {
            orgId,
            branchId
        })

        return redirect(redirectUrl, {
            headers: {
                ...headers,
                'Set-Cookie': clearCookie,
            },
        })
    }

    return { site, githubAccountLogin }
}

export default function ConnectGitHub() {
    const { site, githubAccountLogin } = useLoaderData<typeof loader>()
    const navigation = useNavigation()
    const isSubmitting = navigation.state === 'submitting'
    const [repoName, setRepoName] = useState(
        `${(site.name || 'site').toLowerCase().replace(/[^a-z0-9]+/g, '-')}-docs`
    )

    return (
        <div className='w-full p-16 grow justify-center min-h-full gap-[40px] flex flex-col items-center'>
            <div className='flex flex-col gap-4 text-center'>
                <h1 className='text-2xl font-semibold'>Create GitHub Repository</h1>
                <p className='opacity-70 max-w-md text-center text-medium text-balance'>
                    Choose a name for your new repository on {githubAccountLogin}
                </p>
            </div>

            <Form method='post' className='flex flex-col gap-6 w-full max-w-md'>
                <div className='flex flex-col gap-2'>
                    <Label htmlFor='repoName'>Repository Name</Label>
                    <Input
                        id='repoName'
                        name='repoName'
                        value={repoName}
                        onChange={(e) => setRepoName(e.target.value)}
                        placeholder='my-docs'
                        required
                        pattern='[a-zA-Z0-9-_]+'
                        title='Repository name can only contain letters, numbers, hyphens, and underscores'
                    />
                    <p className='text-sm text-muted-foreground'>
                        This will create a repository at github.com/{githubAccountLogin}/{repoName}
                    </p>
                </div>

                <Button
                    type='submit'
                    className='font-semibold'
                    isLoading={isSubmitting}
                    disabled={isSubmitting}
                >
                    Create Repository
                </Button>
            </Form>
        </div>
    )
}


export async function action({ request, params }: Route.ActionArgs) {
    const { userId, headers } = await getSession({ request })
    const { orgId, branchId } = params

    if (!userId) {
        throw new Response('Unauthorized', { status: 401 })
    }

    // Parse form data
    const formData = await request.formData()
    const repoName = formData.get('repoName') as string

    if (!repoName || !/^[a-zA-Z0-9-_]+$/.test(repoName)) {
        throw new Response('Invalid repository name', { status: 400 })
    }

    // Parse cookies
    const cookies = cookie.parse(request.headers.get('Cookie') || '')
    const githubDataStr = cookies[GITHUB_LOGIN_DATA_COOKIE]

    if (!githubDataStr) {
        throw new Response('Missing GitHub login data', { status: 400 })
    }

    const data: GithubLoginRequestData = JSON.parse(decodeURIComponent(githubDataStr))
    const githubAccountLogin = data.githubAccountLogin

    // Get branch and GitHub installation
    const [branch, githubInstallation] = await Promise.all([
        prisma.siteBranch.findFirst({
            where: {
                branchId,
                site: {
                    org: {
                        orgId,
                        users: { some: { userId } },
                    },
                },
            },
            include: {
                site: true,
                domains: true,
            },
        }),
        prisma.githubInstallation.findFirst({
            where: {
                orgs: {
                    some: {
                        orgId,
                        appId: env.GITHUB_APP_ID,
                    },
                },
                accountLogin: githubAccountLogin,
            },
        }),
    ])

    if (!branch || !githubInstallation) {
        throw new Response('Branch or GitHub installation not found', { status: 404 })
    }

    const site = branch.site
    const siteId = site.siteId
    const existingBranch = branch

    // Always update githubOwner when connecting
    const updateData: Prisma.SiteUpdateInput = {
        githubOwner: githubAccountLogin,
    }

    // Create site-github connection
    await prisma.siteGithubInstallation.upsert({
        where: {
            installationId_appId_siteId: {
                installationId: githubInstallation.installationId,
                appId: env.GITHUB_APP_ID!,
                siteId,
            },
        },
        create: {
            installationId: githubInstallation.installationId,
            appId: env.GITHUB_APP_ID!,
            siteId,
        },
        update: {},
    })

    // Create new repository
    const octokit = await getOctokit(githubInstallation)

    // Check if repo exists
    const exists = await doesRepoExist({
        octokit: octokit.rest,
        owner: githubAccountLogin,
        repo: repoName,
    })

    if (exists) {
        throw new Response('Repository already exists', { status: 400 })
    }

    // Get existing domain for homepage
    const existingDomain = existingBranch?.domains?.find(
        d => d.domainType === 'internalDomain'
    )
    const homepage = existingDomain
        ? `https://${existingDomain.host}`
        : `https://${site.siteId}.${env.APPS_DOMAIN}`

    // Get site files to create repository with actual content
    const files: Array<{filePath: string, content: string, encoding?: string}> = []

    // Get all pages and meta files
    const [pages, metaFiles] = await Promise.all([
        prisma.markdownPage.findMany({
            where: { branchId: branch.branchId },
            include: { content: true },
        }),
        prisma.metaFile.findMany({
            where: { branchId: branch.branchId },
        }),
    ])

    // Add markdown pages
    for (const page of pages) {
        if (page.content?.markdown) {
            files.push({
                filePath: page.githubPath,
                content: page.content.markdown,
            })
        }
    }

    // Add meta files
    for (const metaFile of metaFiles) {
        files.push({
            filePath: metaFile.githubPath,
            content: JSON.stringify(metaFile.jsonData, null, 2),
        })
    }

    // Add docs json with existing docsJson or default
    const docsJson = existingBranch?.docsJson || {
        ...defaultStartingHolocronJson,
        siteId: site.siteId,
        name: site.name || 'Docs',
    }
    files.push({
        filePath: DOCS_JSON_BASENAME,
        content: JSON.stringify(docsJson, null, 2),
    })

    // If no files exist, use starter template as fallback
    if (files.length <= 1) { // Only docs json
        files.push(...exampleDocs)
    }

    // Create the repository
    const result = await createNewRepo({
        files,
        isGithubOrg: githubInstallation.accountType === 'ORGANIZATION',
        octokit: octokit.rest,
        owner: githubAccountLogin,
        oauthToken: githubInstallation.oauthToken!,
        privateRepo: false,
        repo: repoName,
        homepage,
    })

    // Update site with GitHub info
    updateData.githubRepo = repoName
    updateData.githubFolder = '' // root folder
    updateData.githubRepoId = result?.githubRepoId

    // Update branch with GitHub info if it exists
    if (existingBranch) {
        await prisma.siteBranch.update({
            where: { branchId: existingBranch.branchId },
            data: {
                githubBranch: result?.branch || 'main',
                lastGithubSyncAt: new Date(),
            },
        })
    }

    // Update site with GitHub owner (and repo if created)
    await prisma.site.update({
        where: { siteId },
        data: updateData,
    })

    // Find the last chat for this branch to redirect to
    const lastChat = await prisma.chat.findFirst({
        where: {
            branchId,
            userId,
        },
        orderBy: {
            createdAt: 'desc',
        },
        select: {
            chatId: true,
        },
    })

    // Clear GitHub data cookie
    const clearCookie = cookie.serialize(GITHUB_LOGIN_DATA_COOKIE, '', {
        ...COOKIE_OPTIONS,
        maxAge: 0,
    })

    // Redirect to the last chat or branch page
    const redirectUrl = lastChat
        ? href('/org/:orgId/branch/:branchId/chat/:chatId', {
            orgId,
            branchId,
            chatId: lastChat.chatId
        })
        : href('/org/:orgId/branch/:branchId', {
            orgId,
            branchId
        })

    return redirect(redirectUrl, {
        headers: {
            ...headers,
            'Set-Cookie': clearCookie,
        },
    })
}
