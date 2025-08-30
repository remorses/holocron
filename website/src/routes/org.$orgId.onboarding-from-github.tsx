import { ulid } from 'ulid'
import { prisma } from 'db'
import { DocsJsonType } from 'docs-website/src/lib/docs-json'
import {
    defaultDocsJsonComments,
    defaultStartingHolocronJson,
} from 'docs-website/src/lib/docs-json-examples'
import { DOCS_JSON_BASENAME } from 'docs-website/src/lib/constants'
import {
    Form,
    href,
    Link,
    redirect,
    useActionData,
    useLoaderData,
    useNavigation,
} from 'react-router'
import { useState } from 'react'
import { apiClient } from '../lib/spiceflow-client'
import { useQuery } from '@tanstack/react-query'
import { Button } from '../components/ui/button'
import {
    Stepper,
    StepperDescription,
    StepperIndicator,
    StepperItem,
    StepperSeparator,
    StepperTitle,
    StepperTrigger,
} from '../components/ui/stepper'
import { getSession } from '../lib/better-auth'
import { env, supportEmail } from '../lib/env'
import { getOctokit, createPullRequestSuggestion } from '../lib/github.server'
import { filesFromGithub, syncSite } from '../lib/sync'
import type { Route } from './+types/org.$orgId.onboarding-from-github'
import { SelectNative } from '../components/ui/select-native'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import * as cookie from 'cookie'
import { GITHUB_LOGIN_DATA_COOKIE } from './api.github.webhooks'
import { GithubLoginRequestData } from '../lib/types'
import { slugKebabCaseKeepExtension } from '../lib/utils'
import { GithubIcon } from '../components/icons'

export async function loader({ request, params }: Route.LoaderArgs) {
    const sessionData = await getSession({ request })
    if (sessionData.redirectTo) {
        throw redirect(sessionData.redirectTo)
    }



    const url = new URL(request.url)
    const currentStep = parseInt(url.searchParams.get('currentStep') || '0', 10)
    const orgId = params.orgId
    const name = sessionData?.user?.name || 'there'
    const userId = sessionData.userId

    // Parse cookies to check for GitHub data
    const cookies = cookie.parse(request.headers.get('Cookie') || '')
    const githubDataStr = cookies[GITHUB_LOGIN_DATA_COOKIE]

    let repos: Array<{ name: string; full_name: string; default_branch: string; private: boolean; pushed_at: string | null | undefined }> = []
    let githubAccountLogin = ''
    let installationId: number | null = null

    if (githubDataStr && currentStep === 1) {
        const data: GithubLoginRequestData = JSON.parse(decodeURIComponent(githubDataStr))
        githubAccountLogin = data.githubAccountLogin

        // Get the GitHub installation
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

        if (githubInstallation) {
            installationId = githubInstallation.installationId
            // Get repositories based on account type
            const octokit = await getOctokit(githubInstallation)

            if (githubInstallation.accountType === 'ORGANIZATION') {
                const { data } = await octokit.rest.repos.listForOrg({
                    org: githubInstallation.accountLogin,
                    per_page: 100,
                    page: 1,
                    direction: 'desc',
                    type: 'all',
                    sort: 'pushed',
                })
                repos = data.map(repo => ({
                    name: repo.name,
                    full_name: repo.full_name,
                    default_branch: repo.default_branch || 'main',
                    private: repo.private,
                    pushed_at: repo.pushed_at,
                }))
            } else {
                const { data } = await octokit.rest.repos.listForUser({
                    username: githubInstallation.accountLogin,
                    per_page: 100,
                    page: 1,
                    direction: 'desc',
                    sort: 'pushed',
                    type: 'all',
                })
                repos = data.map(repo => ({
                    name: repo.name,
                    full_name: repo.full_name,
                    default_branch: repo.default_branch || 'main',
                    private: repo.private,
                    pushed_at: repo.pushed_at,
                }))
            }
        }
    }

    return { currentStep, orgId, name, repos, githubAccountLogin, installationId }
}

export async function action({ request, params }: Route.ActionArgs) {
    const { orgId } = params
    const formData = await request.formData()
    const syncRepo = formData.get('sync-repo')

    const { userId } = await getSession({ request })

    if (syncRepo) {
        const selectedRepo = formData.get('selectedRepo') as string
        const selectedBranch = formData.get('selectedBranch') as string || 'main'
        let basePath = formData.get('basePath') as string || ''

        // Remove leading and trailing slashes if present
        if (basePath.startsWith('/')) {
            basePath = basePath.substring(1)
        }
        if (basePath.endsWith('/')) {
            basePath = basePath.slice(0, -1)
        }

        // Parse cookies
        const cookies = cookie.parse(request.headers.get('Cookie') || '')
        const githubDataStr = cookies[GITHUB_LOGIN_DATA_COOKIE]

        if (!githubDataStr) {
            throw new Error('Missing GitHub login data')
        }

        const data: GithubLoginRequestData = JSON.parse(decodeURIComponent(githubDataStr))
        const githubAccountLogin = data.githubAccountLogin

        // Parse repo name and owner
        const [owner, repo] = selectedRepo.split('/')
        if (!owner || !repo) {
            throw new Error('Invalid repository format')
        }

        // Get GitHub installation
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
            throw new Error(`GitHub installation not found for ${githubAccountLogin}`)
        }

        const siteId = ulid()
        const branchId = ulid()
        const randomHash = Math.random().toString(36).substring(2, 10)
        const userName = slugKebabCaseKeepExtension(
            repo || 'holocron-site',
        )
        const internalHost = `${userName}-${randomHash}.${env.APPS_DOMAIN}`
        const domains =
            process.env.NODE_ENV === 'development'
                ? [`${userName}-${randomHash}.localhost`, internalHost]
                : [internalHost]

        // Create the site
        const site = await prisma.site.create({
            data: {
                name: repo,
                siteId,
                orgId,
                githubOwner: owner,
                githubRepo: repo,
                githubFolder: basePath,
                githubInstallations: {
                    create: {
                        installationId: githubInstallation.installationId,
                        appId: env.GITHUB_APP_ID!,
                    },
                },
                branches: {
                    create: {
                        branchId,
                        title: 'Main',
                        githubBranch: 'main', // Will be updated during sync if different
                    },
                },
            },
        })

        console.log(`created site ${siteId} syncing from ${owner}/${repo}`)

        // Get octokit
        const octokit = await getOctokit(githubInstallation)

        // Update branch with selected GitHub branch
        await prisma.siteBranch.update({
            where: { branchId },
            data: {
                githubBranch: selectedBranch,
            },
        })

        // Sync from GitHub
        const files = filesFromGithub({
            installationId: githubInstallation.installationId,
            owner,
            repo,
            branchId,
            basePath,
            branch: selectedBranch,
        })

        // Create default docsJson if not exists
        const docsJson: DocsJsonType = {
            ...defaultStartingHolocronJson,
            siteId,
            name: repo,
            domains,
        }

        // Add the docsJson file to the sync manually (to avoid branch protection issues)
        const docsJsonPath = basePath ? `${basePath}/${DOCS_JSON_BASENAME}` : DOCS_JSON_BASENAME
        const docsJsonContent = JSON.stringify(docsJson, null, 2)

        // Create an async generator that includes the docsJson file
        async function* filesWithDocsJson() {
            // First yield the docsJson file
            yield {
                type: 'docsJson' as const,
                content: docsJsonContent,
                githubPath: docsJsonPath,
                githubSha: '',
            }
            // Then yield all files from the repository
            yield* files
        }

        const { pageCount } = await syncSite({
            files: filesWithDocsJson(),
            branchId,
            siteId,
            githubFolder: basePath,
            name: repo,
            docsJson,
        })

        if (pageCount === 0) {
            // Clean up the created site if no pages found
            await prisma.site.delete({
                where: { siteId },
            })
            throw new Error('No documentation pages found in the repository. Please ensure your repository contains markdown files.')
        }

        const { url: prUrl } = await createPullRequestSuggestion({
            files: [{
                filePath: docsJsonPath,
                content: docsJsonContent,
            }],
            octokit,
            owner,
            repo,
            branch: selectedBranch,
            accountLogin: githubAccountLogin,
            fork: false,
            title: `Add ${DOCS_JSON_BASENAME} configuration`,
            body: `This PR adds the Holocron configuration file to configure the docs website at [${internalHost}](https://${internalHost}).\n\nThe configuration includes:\n- Site ID: ${siteId}\n- Site name: ${repo}\n- Domain configuration\n\nCreated by [Holocron](https://holocron.so) - Modern documentation platform`,
        })
        console.log(`Created PR for ${DOCS_JSON_BASENAME}: ${prUrl}`)

        // Create a chat for the branch
        const chat = await prisma.chat.create({
            data: {
                userId,
                branchId,
            },
        })

        // Clear GitHub data cookie
        const clearCookie = cookie.serialize(GITHUB_LOGIN_DATA_COOKIE, '', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 0,
            path: '/',
        })

        const chatId = chat.chatId
        throw redirect(
            href('/org/:orgId/branch/:branchId/chat/:chatId', {
                orgId,
                branchId,
                chatId,
            }),
            {
                headers: {
                    'Set-Cookie': clearCookie,
                },
            }
        )
    }

    return null
}

export default function OnboardingFromGithub({ loaderData }: Route.ComponentProps) {
    const { currentStep, repos, githubAccountLogin, orgId, name, installationId } = loaderData
    const [showAlternative, setShowAlternative] = useState(false)
    const [selectedRepo, setSelectedRepo] = useState(repos[0]?.full_name || '')
    const [selectedBranch, setSelectedBranch] = useState('main')
    const [basePath, setBasePath] = useState('')

    const [owner, repo] = selectedRepo.split('/') || ['', '']

    const { data: branchesData, isLoading: loadingBranches } = useQuery({
        queryKey: ['branches', orgId, owner, repo, installationId],
        queryFn: async () => {
            if (!owner || !repo || !installationId) return null
            const { data, error } = await apiClient.api.getRepoBranches.post({ orgId, owner, repo, installationId })
            if (error || !data) {
                console.error('Failed to fetch branches:', error)
                return null
            }
            // Set default branch when branches are loaded
            const defaultBranch = data.branches.find(b => b.isDefault)
            if (defaultBranch) {
                setSelectedBranch(defaultBranch.name)
            }
            return data
        },
        enabled: !!owner && !!repo && !!installationId,
    })

    const branches = branchesData?.branches || []

    const githubInstallUrl = new URL(
        href('/api/github/install'),
        env.PUBLIC_URL,
    )

    // For reconnect, keep the same step (1), for initial connect go to step 1
    const nextStep = currentStep >= 1 ? 1 : currentStep + 1
    githubInstallUrl.searchParams.set(
        'next',
        href('/org/:orgId/onboarding-from-github', { orgId }) +
            `?currentStep=${nextStep}`,
    )

    const navigation = useNavigation()
    const isLoading = navigation.state === 'submitting'

    return (
        <div className='flex flex-col h-full grow justify-center gap-12 max-w-2xl mx-auto p-8'>
            <div className='space-y-4'>
                <div>
                    <h1 className='text-2xl capitalize font-bold text-white'>
                        Hello, {name}
                    </h1>
                    <p className='text-gray-400'>
                        Let's sync your documentation from an existing GitHub repository
                    </p>
                </div>
            </div>

            <div className='space-y-8'>
                <Stepper className='lg:min-w-[500px]' defaultValue={currentStep + 1} orientation='vertical'>
            <StepperItem
                step={1}
                className='relative items-start not-last:flex-1'
            >
                <StepperTrigger
                    className={`items-start rounded last:pb-0 pb-12`}
                >
                    <StepperIndicator />
                    <div className='mt-0.5 space-y-0.5 px-2 text-left'>
                        <StepperTitle>Sign in with GitHub</StepperTitle>
                        {currentStep === 0 && (
                            <>
                                <StepperDescription>
                                    To get started, log in with your GitHub
                                    account
                                </StepperDescription>
                                <div className='pt-4'>
                                    {!showAlternative ? (
                                        <>
                                            <Link to={githubInstallUrl.toString()}>
                                                <Button className=''>
                                                    <GithubIcon />
                                                    Connect GitHub
                                                </Button>
                                            </Link>
                                            {/*TODO show cli instructions*/}
                                            {/*<div className='pt-2'>
                                                <button
                                                    className='text-gray-400 text-xs hover:text-gray-300'
                                                    onClick={() => {setShowAlternative(true)}}
                                                >
                                                    Don't want to authorize GitHub Auth? ▼
                                                </button>
                                            </div>*/}
                                        </>
                                    ) : (
                                        <div className='space-y-4'>
                                            <div className='p-4 bg-gray-800/50 rounded-lg border'>
                                                <p className='text-sm text-gray-300 mb-3'>
                                                    Run this command to download a template docs folder and deploy it:
                                                </p>
                                                <div className='bg-black/50 p-3 rounded font-mono text-sm text-green-400'>
                                                    npx -y @holocron.so/cli init
                                                </div>
                                            </div>
                                            <button
                                                className='text-gray-400 text-xs hover:text-gray-300'
                                                onClick={() => {setShowAlternative(false)}}
                                            >
                                                ← Back to GitHub Auth
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                        {currentStep >= 1 && (
                            <>
                                <StepperDescription className='text-green-600'>
                                    Connected as {githubAccountLogin}
                                </StepperDescription>
                                <div className='pt-2'>
                                    <Link to={githubInstallUrl.toString()}>
                                        <Button variant='ghost' size='sm'>
                                            Reconnect GitHub
                                        </Button>
                                    </Link>
                                </div>
                            </>
                        )}
                    </div>
                </StepperTrigger>
                <StepperSeparator className='absolute inset-y-0 top-[calc(1.5rem+0.125rem)] left-3 -order-1 m-0 -translate-x-1/2 group-data-[orientation=horizontal]/stepper:w-[calc(100%-1.5rem-0.25rem)] group-data-[orientation=horizontal]/stepper:flex-none group-data-[orientation=vertical]/stepper:h-[calc(100%-1.5rem-0.25rem)]' />
            </StepperItem>

            <StepperItem
                step={2}
                className='relative items-start not-last:flex-1'
            >
                <StepperTrigger className='items-start rounded pb-12 last:pb-0'>
                    <StepperIndicator />
                    <div className='mt-0.5 space-y-0.5 px-2 text-left'>
                        <StepperTitle>Choose repository</StepperTitle>
                        <StepperDescription>
                            Select an existing repository to sync your documentation from
                        </StepperDescription>
                        {currentStep == 1 && (
                            <div className='pt-4'>
                                <Form method='post' className='flex flex-col gap-4'>
                                    <input
                                        type='hidden'
                                        name='sync-repo'
                                        value='true'
                                    />

                                    <div className='flex flex-col gap-2'>
                                        <Label htmlFor='selectedRepo'>Repository</Label>
                                        <SelectNative
                                            id='selectedRepo'
                                            name='selectedRepo'
                                            value={selectedRepo}
                                            onChange={(e) => {setSelectedRepo(e.target.value)}}
                                            className='w-full'
                                        >
                                            {repos.length === 0 ? (
                                                <option value=''>No repositories found</option>
                                            ) : (
                                                repos.map((repo) => (
                                                    <option
                                                        key={repo.full_name}
                                                        value={repo.full_name}
                                                    >
                                                        {repo.full_name} {repo.private && '(private)'}
                                                    </option>
                                                ))
                                            )}
                                        </SelectNative>
                                        {repos.length === 0 && (
                                            <p className='text-sm text-red-500'>
                                                No repositories accessible. Please configure repository access in your GitHub App settings.
                                            </p>
                                        )}
                                    </div>

                                    <div className='flex flex-col gap-2'>
                                        <Label htmlFor='selectedBranch'>Branch</Label>
                                        <SelectNative
                                            id='selectedBranch'
                                            name='selectedBranch'
                                            value={selectedBranch}
                                            onChange={(e) => {setSelectedBranch(e.target.value)}}
                                            className='w-full'
                                            disabled={loadingBranches || branches.length === 0}
                                        >
                                            {loadingBranches ? (
                                                <option value=''>Loading branches...</option>
                                            ) : branches.length === 0 ? (
                                                <option value='main'>main</option>
                                            ) : (
                                                branches.map((branch) => (
                                                    <option key={branch.name} value={branch.name}>
                                                        {branch.name} {branch.isDefault && '(default)'}
                                                    </option>
                                                ))
                                            )}
                                        </SelectNative>
                                    </div>

                                    <div className='flex flex-col gap-2'>
                                        <Label htmlFor='basePath'>
                                            Base Path (optional)
                                        </Label>
                                        <Input
                                            id='basePath'
                                            name='basePath'
                                            value={basePath}
                                            onChange={(e) => {setBasePath(e.target.value)}}
                                            placeholder='docs'
                                            pattern='[a-zA-Z0-9-_/]*'
                                            title='Base path can only contain letters, numbers, hyphens, underscores, and slashes'
                                        />
                                        <p className='text-sm text-muted-foreground'>
                                            Specify a subdirectory if your docs are not in the repository root
                                        </p>
                                    </div>

                                    <Button
                                        isLoading={isLoading}
                                        type='submit'
                                        disabled={repos.length === 0 || !selectedRepo}
                                    >
                                        Create Site
                                    </Button>
                                    <p className='text-sm text-muted-foreground'>
                                        Creating the site will open a pull request to add a {DOCS_JSON_BASENAME} configuration file to your repository
                                    </p>
                                </Form>
                            </div>
                        )}
                    </div>
                </StepperTrigger>
            </StepperItem>
                </Stepper>

                <p className='text-gray-400 text-sm text-center'>
                    Need help?{' '}
                    <a className='text-primary' href={`mailto:${supportEmail}`}>
                        Email support
                    </a>
                </p>
            </div>
        </div>
    )
}
