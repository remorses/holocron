import { prisma } from 'db'
import cuid from '@bugsnag/cuid'
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
import { createNewRepo, doesRepoExist, getOctokit } from '../lib/github.server'
import { pagesFromFilesList, syncSite } from '../lib/sync'
import exampleDocs from 'website/scripts/example-docs.json'
import type { Route } from './+types/org.$orgId.onboarding'
import { cloudflareClient } from '../lib/cloudflare'

export async function loader({ request, params }: Route.LoaderArgs) {
    const sessionData = await getSession({ request })
    if (sessionData.redirectTo) {
        throw redirect(sessionData.redirectTo)
    }

    const url = new URL(request.url)
    const currentStep = parseInt(url.searchParams.get('currentStep') || '0', 10)
    const orgId = params.orgId
    const name = sessionData?.user?.name || 'there'
    return { currentStep, orgId, name }
}

export async function action({ request, params }: Route.ActionArgs) {
    const { orgId } = params
    const formData = await request.formData()
    const createRepo = formData.get('create-repo')
    const url = new URL(request.url)

    const { userId } = await getSession({ request })
    if (createRepo) {
        const githubAccountLogin = url.searchParams.get(
            'githubAccountLogin',
        ) as string
        if (!githubAccountLogin) {
            throw new Error(`missing githubAccountLogin`)
        }
        // Find the GitHub installation for the user's organization
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
            throw new Error(
                `GitHub installation not found for ${githubAccountLogin}`,
            )
        }

        const repo = `fumabase-starter`
        console.log('Creating repository...')
        const octokit = await getOctokit(githubInstallation)
        const name = `${repo}`
        const siteId = cuid()
        const randomHash = Math.random().toString(36).substring(2, 10)
        const internalHost = `${githubAccountLogin}-${randomHash}.${env.APPS_DOMAIN}`
        const files = pagesFromFilesList({
            files: exampleDocs,
            docsJson: {
                siteId,
                name,
                domains: [internalHost],
            },
        })
        const owner = githubAccountLogin
        const exists = await doesRepoExist({
            octokit: octokit.rest,
            owner,
            repo,
        })
        const branchId = cuid()

        const [result, site] = await Promise.all([
            !exists &&
                createNewRepo({
                    files: await Array.fromAsync(files),
                    isGithubOrg:
                        githubInstallation.accountType === 'ORGANIZATION',
                    octokit: octokit.rest,
                    owner,
                    oauthToken: githubInstallation.oauthToken!,
                    privateRepo: false,
                    repo,
                }),
            // Create a site for the newly created repository
            prisma.site.create({
                data: {
                    name,
                    siteId,
                    orgId: orgId,
                    githubOwner: owner,
                    githubRepo: repo,
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
                            // domain will be created based on fumabase.json by syncSite
                        },
                    },
                },
            }),
        ])

        console.log(`created site ${siteId}`)

        // Create the branch with domain

        await syncSite({
            files: files,
            trieveDatasetId: undefined,
            branchId,
            orgId,
            siteId,
            name: `${githubAccountLogin} docs`,
        })

        // Create a chat for the branch
        const chat = await prisma.chat.create({
            data: {
                userId,

                branchId,
            },
        })
        const chatId = chat.chatId
        throw redirect(
            href('/org/:orgId/site/:siteId/chat/:chatId', {
                orgId,
                siteId,
                chatId,
            }),
        )
    }

    return null
}
interface OnboardingStepperProps {
    currentStep: number
}

function OnboardingStepper({ currentStep }: OnboardingStepperProps) {
    const { orgId } = useLoaderData<typeof loader>()
    const [showAlternative, setShowAlternative] = useState(false)
    const githubInstallUrl = new URL(
        href('/api/github/install'),
        env.PUBLIC_URL,
    )
    const actionData = useActionData<typeof action>()

    githubInstallUrl.searchParams.set(
        'next',
        href('/org/:orgId/onboarding', { orgId }) +
            `?currentStep=${currentStep + 1}`,
    )
    const navigation = useNavigation()
    const isLoading = navigation.state === 'submitting'
    return (
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
                                                    <svg
                                                        className='w-4 h-4'
                                                        fill='currentColor'
                                                        viewBox='0 0 20 20'
                                                    >
                                                        <path
                                                            fillRule='evenodd'
                                                            d='M10 0C4.477 0 0 4.484 0 10.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0110 4.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.203 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.942.359.31.678.921.678 1.856 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0020 10.017C20 4.484 15.522 0 10 0z'
                                                            clipRule='evenodd'
                                                        />
                                                    </svg>
                                                    Connect GitHub
                                                </Button>
                                            </Link>
                                            <div className='pt-2'>
                                                <button
                                                    className='text-gray-400 text-xs hover:text-gray-300'
                                                    onClick={() => {setShowAlternative(true)}}
                                                >
                                                    Don't want to authorize GitHub Auth? ▼
                                                </button>
                                            </div>
                                        </>
                                    ) : (
                                        <div className='space-y-4'>
                                            <div className='p-4 bg-gray-800/50 rounded-lg border'>
                                                <p className='text-sm text-gray-300 mb-3'>
                                                    Run this command to download a template docs folder and deploy it:
                                                </p>
                                                <div className='bg-black/50 p-3 rounded font-mono text-sm text-green-400'>
                                                    npx fumabase init
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
                        <StepperTitle>Create documentation repo</StepperTitle>
                        <StepperDescription>
                            Your documentation content will be managed through
                            this repo
                        </StepperDescription>
                        {currentStep == 1 && (
                            <div className='pt-4'>
                                <Form method='post'>
                                    <input
                                        type='hidden'
                                        name='create-repo'
                                        value='true'
                                    />
                                    <Button isLoading={isLoading} type='submit'>
                                        Create Example Repo
                                    </Button>
                                </Form>
                            </div>
                        )}
                    </div>
                </StepperTrigger>
                <StepperSeparator className='absolute inset-y-0 top-[calc(1.5rem+0.125rem)] left-3 -order-1 m-0 -translate-x-1/2 group-data-[orientation=horizontal]/stepper:w-[calc(100%-1.5rem-0.25rem)] group-data-[orientation=horizontal]/stepper:flex-none group-data-[orientation=vertical]/stepper:h-[calc(100%-1.5rem-0.25rem)]' />
            </StepperItem>

            {/* <StepperItem
                step={3}
                className='relative items-start not-last:flex-1'
            >
                <StepperTrigger className='items-start rounded pb-12 last:pb-0'>
                    <StepperIndicator />
                    <div className='mt-0.5 space-y-0.5 px-2 text-left'>
                        <StepperTitle>Customize your website</StepperTitle>
                        <StepperDescription>
                            Your website is ready. Let's customize it!
                        </StepperDescription>
                        {currentStep >= 2 && (
                            <div className='pt-4'>
                                <Button type='button'>Go to Dashboard</Button>
                            </div>
                        )}
                    </div>
                </StepperTrigger>
            </StepperItem> */}
        </Stepper>
    )
}

export default function Index({ loaderData }: Route.ComponentProps) {
    return (
        <div className='flex flex-col h-full grow justify-center gap-12 max-w-2xl mx-auto p-8'>
            <div className='space-y-4'>
                <div>
                    <h1 className='text-2xl capitalize font-bold text-white'>
                        Hello, {loaderData.name}
                    </h1>
                    <p className='text-gray-400'>
                        Let's set up your first documentation deployment
                    </p>
                </div>
            </div>

            <div className='space-y-8'>
                <OnboardingStepper currentStep={loaderData.currentStep} />

                <p className='text-gray-400 text-sm'>
                    Need help?{' '}
                    <a className='text-primary' href={`mailto:${supportEmail}`}>
                        Email support
                    </a>
                </p>
            </div>
        </div>
    )
}
