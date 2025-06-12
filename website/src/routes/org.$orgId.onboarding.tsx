import {
    href,
    Link,
    redirect,
    Form,
    useLoaderData,
    useActionData,
    useNavigation,
} from 'react-router'
import { getSession } from '../lib/better-auth'
import type { Route } from './+types/org.$orgId.onboarding'
import {
    Stepper,
    StepperDescription,
    StepperIndicator,
    StepperItem,
    StepperSeparator,
    StepperTitle,
    StepperTrigger,
} from '../components/ui/stepper'
import { env, supportEmail } from '../lib/env'
import { Button } from '../components/ui/button'
import { createNewRepo, doesRepoExist, getOctokit } from '../lib/github.server'
import { prisma } from 'db'
import { Octokit } from 'octokit'
import { pagesFromDirectory, syncSite } from '../lib/sync'
import path from 'path'

export async function loader({ request, params }: Route.LoaderArgs) {
    const { userId, redirectTo } = await getSession({ request })
    if (redirectTo) {
        throw redirect(redirectTo)
    }

    const url = new URL(request.url)
    const currentStep = parseInt(url.searchParams.get('currentStep') || '0', 10)
    const orgId = params.orgId
    return { currentStep, orgId }
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
                orgId,
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
        const pages = pagesFromDirectory(
            path.resolve('scripts/example-docs-site'),
        )
        const owner = githubAccountLogin
        const exists = await doesRepoExist({
            octokit: octokit.rest,
            owner,
            repo,
        })
        const [result, site] = await Promise.all([
            !exists &&
                createNewRepo({
                    files: await Array.fromAsync(pages),
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
                    name: repo,
                    orgId: orgId,
                    installationId: githubInstallation.installationId,
                    // installationId,
                },
            }),
        ])
        const internalHost = `${githubAccountLogin}.${env.APPS_DOMAIN}`
        const siteId = site.siteId
        console.log(`created site ${siteId}`)
        const tabId = 'main'
        await syncSite({
            pages,
            internalHost,
            tabId,
            orgId,
            siteId,
            name: `${githubAccountLogin} docs`,
        })
        throw redirect(href('/org/:orgId/site/:siteId', { orgId, siteId }))

        return { siteId }
    }

    return null
}
interface OnboardingStepperProps {
    currentStep: number
}

function OnboardingStepper({ currentStep }: OnboardingStepperProps) {
    const { orgId } = useLoaderData<typeof loader>()
    const githubInstallUrl = new URL(
        href('/api/github/install'),
        env.PUBLIC_URL,
    )
    const actionData = useActionData<typeof action>()
    const siteId = actionData?.siteId
    githubInstallUrl.searchParams.set(
        'next',
        href('/org/:orgId/onboarding', { orgId }) +
            `?currentStep=${currentStep + 1}`,
    )
    const navigation = useNavigation()
    const isLoading = navigation.state === 'submitting'
    return (
        <Stepper defaultValue={currentStep + 1} orientation='vertical'>
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
                                    {/* <div className='pt-2'>
                                        <button className='text-gray-400 text-xs hover:text-gray-300'>
                                            Don't want to authorize GitHub OAuth? ▼
                                        </button>
                                    </div> */}
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

            <StepperItem
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
                                <Link
                                    to={href('/org/:orgId/site/:siteId', {
                                        orgId,
                                        siteId: siteId!,
                                    })}
                                >
                                    <Button type='button'>
                                        Go to Dashboard
                                    </Button>
                                </Link>
                            </div>
                        )}
                    </div>
                </StepperTrigger>
            </StepperItem>
        </Stepper>
    )
}

export default function Index({ loaderData }: Route.ComponentProps) {
    return (
        <div className='flex flex-col gap-12 max-w-2xl mx-auto p-8'>
            <div className='space-y-4'>
                <div>
                    <h1 className='text-2xl font-bold text-white'>
                        Hello, test
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
                        Contact support
                    </a>
                </p>
            </div>
        </div>
    )
}
