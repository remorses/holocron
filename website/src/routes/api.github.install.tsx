
import { prisma } from 'db'

import { useState } from 'react'
import {
    Form,
    redirect,
    useLoaderData,
    useNavigation,
    useSearchParams,
    type LoaderFunctionArgs,
} from 'react-router'
import {
    checkGitHubIsInstalled,
    GithubLoginRequestData,
} from 'website/src/lib/github.server'
import { isTruthy } from 'website/src/lib/utils'

import { env } from '../lib/env'
import { getSupabaseSession } from '../lib/better-auth'
import { Button } from '../components/ui/button'
import { GithubState } from '../lib/types'

enum FormNames {
    chooseAnother = '_chooseAnother',
    chosenOrg = 'chosenOrg',
}

export default function ChooseOrg() {
    const { installations } = useLoaderData<typeof loader>()
    const [searchParams] = useSearchParams()
    const navigation = useNavigation()
    const isLoading = navigation.state !== 'idle'
    const [selectedAccountLogin, setSelectedAccountLogin] = useState(
        installations?.find((x) => x)?.accountLogin,
    )
    const installation = installations.find(
        (org) => org.accountLogin === selectedAccountLogin,
    )
    const settings = installation
        ? installation?.accountType === 'ORGANIZATION'
            ? `https://github.com/organizations/${installation.accountLogin}/settings/installations/${installation.installationId}`
            : `https://github.com/settings/installations/${installation?.installationId}`
        : ''
    return (
        <div className='w-full md:-mt-[100px] grow justify-center h-full gap-[60px] flex flex-col items-center'>
            <div className='flex flex-col gap-4 text-center'>
                <h1 className='text-2xl max-w-md text-center text-balance'>
                    Choose a GitHub organization or account to connect to Framer
                </h1>
                <p className='opacity-70 max-w-md text-center text-medium text-balance'>
                    Choose which GitHub organization or account you want to
                    connect to Framer. You can add more organizations later.
                </p>
            </div>
            <Form className='flex dark flex-col gap-6'>
                <select
                    // value={selectedAccountLogin}
                    className='rounded-md py-1 border-0 dark:bg-default-200'
                    name={FormNames.chosenOrg}
                    onChange={(e) => {
                        const value = e.target.value
                        if (value === FormNames.chooseAnother) {
                            setSelectedAccountLogin(undefined)
                        } else {
                            setSelectedAccountLogin(value)
                        }
                    }}
                >
                    {installations.map((org) => {
                        return (
                            <option
                                key={org.accountLogin}
                                value={org.accountLogin}
                            >
                                {org.accountLogin}
                            </option>
                        )
                    })}
                    <option value={FormNames.chooseAnother}>
                        add another organization
                    </option>
                </select>

                {!!selectedAccountLogin && (
                    <div className='flex flex-col gap-2'>
                        <div className='text-sm opacity-70'>
                            change accessible repositories{' '}
                            <a
                                href={settings}
                                target='_blank'
                                className='text-sm text-primary hover:opacity-80'
                            >
                                here
                            </a>
                        </div>
                    </div>
                )}

                {/* add all other search params with hidden inputs */}
                {Array.from(searchParams).map(([key, value]) => {
                    return (
                        <input
                            key={key}
                            type='hidden'
                            name={key}
                            value={value}
                        />
                    )
                })}

                <Button
                    color='primary'
                    className='font-semibold'
                    isLoading={isLoading}
                    type='submit'
                >
                    Connect GitHub
                </Button>
            </Form>
        </div>
    )
}

export async function loader({ request }: LoaderFunctionArgs) {
    const url = new URL(request.url)
    let afterFramerLoginUrl = url.searchParams.get('next') || ''

    const chosenOrg =
        url.searchParams.get(FormNames.chosenOrg)?.toString() || ''

    const { userId, headers } = await getSupabaseSession({
        request,
    })
    if (!afterFramerLoginUrl) {
        throw new Error('URL is malformed, missing next param')
    }

    let orgId = userId
    if (!orgId) {
        throw new Error('Unauthorized')
    }
    const githubLogin = await getGithubUserLogin({ userId })

    const [githubInstallations] = await Promise.all([
        prisma.githubInstallation.findMany({
            where: {
                status: 'active',
                appId: env.GITHUB_APP_ID,
                memberLogins: { hasSome: [githubLogin] },
            },
        }),
        prisma.user.update({
            where: { id: userId },
            data: { githubLogin: githubLogin },
        }),
    ])
    let installations = (
        await Promise.all(
            githubInstallations.map(async (installation) => {
                const ok = await checkGitHubIsInstalled({
                    installationId: installation.installationId,
                })
                if (ok) {
                    return installation
                }
                console.log('installation check failed, removing', {
                    installationId: installation.installationId,
                    orgId: installation.orgId,
                })
                // await prisma.githubInstallation.delete({
                //     where: {
                //         installationId_orgId: {
                //             installationId: installation.installationId,
                //             orgId: installation.orgId
                //         }
                //     },
                // })
                return null
            }),
        )
    ).filter(isTruthy)

    if (installations.some((x) => x.accountLogin === chosenOrg)) {
        let url = new URL(afterFramerLoginUrl)
        let data: GithubLoginRequestData = { githubAccountLogin: chosenOrg }
        url.searchParams.set('data', JSON.stringify(data))
        return redirect(url.toString(), { headers })
    }

    if (!chosenOrg && installations.length) {
        // render the org selection page
        return {
            installations,
        }
    } else {
        console.log('adding another github installation')
    }

    const githubInstallationUrl = new URL(
        `https://github.com/apps/${env.GITHUB_APP_NAME}/installations/new`,
    )
    const redirectUri = new URL(
        '/api/markdown-plugin/github/callback',
        env.PUBLIC_URL,
    )
    // redirectUri.searchParams.set('next', next)

    githubInstallationUrl.searchParams.set(
        'redirect_uri',
        redirectUri.toString(),
    )
    let state: GithubState = {
        next: afterFramerLoginUrl,
        // redirectToPath: after.toString()
    }

    githubInstallationUrl.searchParams.set('state', JSON.stringify(state))

    return redirect(githubInstallationUrl.toString(), { headers })
}
