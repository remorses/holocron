import {
    redirect,
    Form,
    useSearchParams,
    useActionData,
    useNavigation,
} from 'react-router'
import { prisma } from 'db'
import { getSession } from 'website/src/lib/better-auth'
import { auth } from 'website/src/lib/better-auth'
import type { Route } from './+types/after-cli-login'
import { Button } from 'website/src/components/ui/button'
import { ShieldCheckIcon, LoaderIcon } from 'lucide-react'

export async function loader({ request }: Route.LoaderArgs) {
    const url = new URL(request.url)
    const cliSessionSecret = url.searchParams.get('cliSessionSecret')

    if (!cliSessionSecret || !/^\d{6}$/.test(cliSessionSecret)) {
        throw new Response('Invalid CLI session secret', { status: 400 })
    }

    const { userId } = await getSession({ request })
    if (!userId) {
        throw redirect(
            `/login?callbackUrl=${encodeURIComponent(url.pathname + url.search)}`,
        )
    }

    return { cliSessionSecret }
}

export async function action({ request }: Route.ActionArgs) {
    const { userId } = await getSession({ request })
    if (!userId) {
        throw new Response('Unauthorized', { status: 401 })
    }

    const formData = await request.formData()
    const cliSessionSecret = formData.get('cliSessionSecret') as string

    if (!cliSessionSecret || !/^\d{6}$/.test(cliSessionSecret)) {
        throw new Response('Invalid CLI session secret', { status: 400 })
    }

    // Create API key for the user
    const apiKeyResult = await auth.api.createApiKey({
        body: {
            name: 'CLI Access',
            metadata: {
                createdFrom: 'cli-login',
            },
        },
        headers: request.headers,
    })

    if (!apiKeyResult?.key) {
        throw new Response('Failed to create API key', { status: 500 })
    }

    // Create or update CLI login session
    const expiresAt = new Date()
    expiresAt.setMinutes(expiresAt.getMinutes() + 10) // 10 minute expiry

    await prisma.cliLoginSession.upsert({
        where: { secret: cliSessionSecret },
        create: {
            secret: cliSessionSecret,
            userId,
            apiKey: apiKeyResult.key,
            expiresAt,
        },
        update: {
            userId,
            apiKey: apiKeyResult.key,
            expiresAt,
        },
    })

    return { success: true }
}

export default function AfterCliLogin() {
    const [searchParams] = useSearchParams()
    const actionData = useActionData<typeof action>()
    const navigation = useNavigation()
    const cliSessionSecret = searchParams.get('cliSessionSecret')

    const isSubmitting = navigation.state === 'submitting'

    const formatCode = (code: string) => {
        return code.split('').join(' ')
    }

    if (actionData?.success) {
        return (
            <div className='flex min-h-screen items-center justify-center p-4'>
                <div className='max-w-md rounded-lg border bg-card p-8 text-center'>
                    <div className='mb-4 flex justify-center'>
                        <ShieldCheckIcon className='h-12 w-12 text-green-600' />
                    </div>
                    <h1 className='mb-4 text-2xl font-bold'>
                        CLI Authorization Successful
                    </h1>
                    <p className='text-muted-foreground'>
                        You have successfully authorized the Fumabase CLI. You
                        can now close this window and return to your terminal.
                    </p>
                </div>
            </div>
        )
    }

    return (
        <div className='flex min-h-screen items-center justify-center p-4'>
            <div className='max-w-md rounded-lg border bg-card p-8'>
                <h1 className='mb-6 text-2xl font-bold'>
                    Authorize Fumabase CLI
                </h1>

                <div className='mb-6 rounded-lg bg-muted p-4'>
                    <p className='mb-2 text-center text-sm text-muted-foreground'>
                        Verification Code:
                    </p>
                    <p className='text-center font-mono text-2xl font-bold tracking-widest'>
                        {cliSessionSecret
                            ? formatCode(cliSessionSecret)
                            : 'Invalid'}
                    </p>
                </div>

                <p className='mb-6 text-sm text-muted-foreground'>
                    Please verify that this code matches the one displayed in
                    your terminal. Only click "Authorize CLI" if you initiated
                    this login request.
                </p>

                <Form method='post'>
                    <input
                        type='hidden'
                        name='cliSessionSecret'
                        value={cliSessionSecret || ''}
                    />
                    <Button
                        type='submit'
                        className='w-full'
                        disabled={!cliSessionSecret || isSubmitting}
                    >
                        {isSubmitting ? (
                            <>Authorizing...</>
                        ) : (
                            <>Authorize CLI</>
                        )}
                    </Button>
                </Form>
            </div>
        </div>
    )
}
