import { Webhooks } from '@octokit/webhooks'
import { Client } from '@upstash/qstash'

import { env } from 'website/src/lib/env'

import { prisma } from 'db'
import { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router'
import { notifyError } from 'website/src/lib/errors'
import { webhookWorkerRequestSchema } from './api.github.webhooks-worker'
import { qstash } from '../lib/qstash'

const logger = console



function getWebhooks() {
    // https://tunnel.unframer.co/api/github/webhooks
    const webhooks = new Webhooks({
        secret: env.SECRET!,
    })

    webhooks.on('marketplace_purchase.purchased', async (event) => {
        const installationId = event.payload.installation?.id
        if (!installationId) {
            logger.log('no installation id in marketplace_purchase.purchased')
            return
        }
        const repo = event.payload.repository
        const org = event.payload.organization

        // const org = event.payload.effective_date
    })

    webhooks.on('installation', async (event) => {
        const installationId = Number(event.payload.installation?.id)

        switch (event.payload.action) {
            case 'created': {
                // const installation = await getOrCreateInstallation({
                //     githubId: payload.installation.id,
                //     deleted: false,
                // })
                // await synchronizeFromInstallationId(installation.id)
                return
            }
            case 'suspend': {
                // const installation = await getOrCreateInstallation({
                //     githubId: payload.installation.id,
                //     deleted: false,
                // })
                // await synchronizeFromInstallationId(installation.id)
                await prisma.githubInstallation.updateMany({
                    where: {
                        installationId,
                    },
                    data: {
                        status: 'suspended',
                    },
                })
                return
            }
            case 'deleted': {
                // const installation = await getOrCreateInstallation({
                //     githubId: payload.installation.id,
                //     deleted: true,
                // })
                // await synchronizeFromInstallationId(installation.id)
                logger.log(`removing installation ids form sites`)
                if (!installationId) {
                    logger.log('no installation id, not deleting')
                    return
                }
                // await prisma.site.updateMany({
                //     where: {
                //         installationId,
                //     },
                //     data: {
                //         installationId: null,
                //     },
                // })
                await prisma.githubInstallation.updateMany({
                    where: {
                        installationId,
                    },
                    data: {
                        status: 'deleted',
                    },
                })

                return
            }
        }
    })

    webhooks.on('push', async (event) => {
        const installationId = event.payload.installation?.id
        if (!installationId) {
            logger.log('no installation id in push event')
            return
        }

        const repo = event.payload.repository
        const commits = event.payload.commits || []

        if (!repo || !repo.owner || commits.length === 0) {
            logger.log('no repository, owner, or commits in push event')
            return
        }

        try {
            const workerUrl = new URL(
                '/api/github/webhooks-worker',
                env.PUBLIC_URL,
            ).toString()

            // Ensure the body matches the webhookWorkerRequestSchema type
            const body = webhookWorkerRequestSchema.parse({
                secret: env.SECRET,
                installationId: Number(installationId),
                owner: repo.owner.login,
                repoName: repo.name,
                githubBranch:
                    event.payload.ref?.replace('refs/heads/', '') || 'main',
                commits,
            })

            await qstash.publishJSON({
                url: workerUrl,
                body,
                flowControl: {
                    key: `github-webhook-${repo.owner.login}-${repo.name}`,
                    parallelism: 1,
                },
            })

            logger.log(
                `Queued webhook processing for ${repo.owner.login}/${repo.name}`,
            )
        } catch (error) {
            logger.error('Error queuing webhook processing:', error)
            notifyError(error, 'github push webhook')
        }
    })

    webhooks.on('repository', async (event) => {
        if (!event.payload.installation?.id) {
            logger.log('no installation id, not renaming')
            return
        }
        switch (event.payload.action) {
            case 'renamed': {
                const repo = event.payload.repository
                const previousRepo = (event.payload as any).changes?.repository
                    ?.name?.from

                logger.log(
                    `renaming repository ${repo?.owner?.login}/${previousRepo} to ${repo?.name}`,
                )

                if (!previousRepo || !repo?.name || !repo?.owner?.login) {
                    logger.log('missing repository information for rename')
                    return
                }

                await prisma.site.updateMany({
                    where: {
                        githubOwner: repo.owner.login,
                        githubRepo: previousRepo,
                        githubInstallations: {
                            some: {
                                installationId: event.payload.installation.id,
                            },
                        },
                    },
                    data: {
                        githubRepo: repo.name,
                    },
                })

                return
            }
            case 'deleted': {
                const repo = event.payload.repository
                logger.log(
                    `deleting repository ${repo?.owner?.login}/${repo?.name}`,
                )
                // await prisma.githubIntegration.deleteMany({
                //     where: {
                //         installationId: event.payload.installation?.id,
                //         owner: repo.owner.login,
                //         repo: repo.name,
                //     },
                // })

                return
            }
        }
        return
    })
    return webhooks
}

export function loader({}: LoaderFunctionArgs) {
    return 'use POST'
}

const webhooks = getWebhooks()
export async function action({ request }: ActionFunctionArgs) {
    const text = await request.text()
    try {
        await webhooks.verifyAndReceive({
            id: request.headers.get('x-github-delivery') || '',
            name: request.headers.get('x-github-event') || ('' as any),
            payload: text,
            signature: request.headers.get('x-hub-signature-256') || '',
        })
    } catch (error) {
        notifyError(error, 'github webhooks')
        return new Response(error.message || error, { status: 400 })
    }
    return new Response('ok')
}
