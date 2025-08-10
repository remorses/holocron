import { Prisma, prisma } from 'db'
import { Loader2Icon } from 'lucide-react'
import { useEffect } from 'react'
import { redirect, useSubmit } from 'react-router'
import { getSession } from '../lib/better-auth'
import type { FileUpdate } from 'docs-website/src/lib/edit-tool'
import { env } from '../lib/env'
import { AppError } from '../lib/errors'
import {
    getOctokit,
    pushToPrOrBranch,
    createPullRequestSuggestion,
} from '../lib/github.server'
import { applyJsonCComments, JsonCComments } from '../lib/json-c-comments'
import type { Route } from './+types/org.$orgId.site.$siteId.chat.$chatId.create-pr'
import { FilesInDraft } from 'docs-website/src/lib/docs-state'
import { keyForDocsJsonFormLocalStorage } from '../lib/constants'

async function createPrSuggestionForChat({
    chatId,
    userId,
    fumabaseJsonc,
}: {
    chatId: string
    userId: string
    fumabaseJsonc?: string
}): Promise<{ prUrl: string; action: 'created' | 'pushed' }> {
    const [chat] = await Promise.all([
        prisma.chat.findFirst({
            where: { chatId, userId },
            include: {
                branch: {
                    include: {
                        site: {
                            include: {
                                githubInstallations: {
                                    where: { appId: env.GITHUB_APP_ID },
                                    include: { github: true },
                                },
                            },
                        },
                    },
                },
            },
        }),
    ])

    let filesInDraft = chat?.filesInDraft as FilesInDraft
    const prBranchRow = chat?.branch

    // If fumabaseJsonc is provided from persisted form data, update it
    if (fumabaseJsonc && filesInDraft && prBranchRow) {
        const site = prBranchRow.site
        const githubFolder = site.githubFolder || ''
        const githubPath = githubFolder
            ? `${githubFolder}/fumabase.jsonc`
            : 'fumabase.jsonc'

        filesInDraft = {
            ...filesInDraft,
            [githubPath]: {
                ...(filesInDraft[githubPath] || {}),
                content: fumabaseJsonc,
                githubPath,
            },
        }
        // Update the chat with the new filesInDraft
        await prisma.chat.update({
            where: { chatId, userId },
            data: {
                filesInDraft: filesInDraft as Prisma.InputJsonValue,
            },
        })
    }

    if (!prBranchRow) {
        throw new AppError('Branch not found or access denied')
    }
    if (!chat) {
        throw new AppError('Chat not found or access denied')
    }

    const site = prBranchRow.site
    if (!site.githubOwner || !site.githubRepo) {
        throw new AppError('GitHub owner and repo must be set for the site')
    }
    const githubInstallation = site.githubInstallations.find(
        (x) => x.appId === env.GITHUB_APP_ID,
    )
    if (!githubInstallation) {
        throw new AppError('GitHub installation for site not found')
    }
    const installationId = githubInstallation.installationId
    const octokit = await getOctokit({ installationId })

    const files = Object.entries(filesInDraft).map(
        ([filePath, fileUpdate]) => ({
            filePath,
            content: fileUpdate?.content || null,
        }),
    )

    const docsJsonFile = files.find((x) =>
        x.filePath.endsWith('fumabase.jsonc'),
    )
    if (docsJsonFile) {
        docsJsonFile.content = applyJsonCComments(
            JSON.parse(docsJsonFile.content || '{}'),
            (prBranchRow.docsJsonComments as JsonCComments) || {},
        )
    }

    if (chat.prNumber) {
        const { data: existingPr } = await octokit.rest.pulls.get({
            owner: site.githubOwner,
            repo: site.githubRepo,
            pull_number: chat.prNumber,
        })
        const result = await pushToPrOrBranch({
            auth: githubInstallation.github.oauthToken || '',
            files,
            owner: site.githubOwner,
            repo: site.githubRepo,
            branch: existingPr.head.ref,
            message: chat.title || '',
        })
        await prisma.chat.update({
            where: { chatId, userId },
            data: {
                lastPushedFiles: filesInDraft as Prisma.InputJsonValue,
                filesInDraft: filesInDraft as Prisma.InputJsonValue,
            },
        })
        return { prUrl: result.prUrl || existingPr.html_url, action: 'pushed' }
    }

    const { data: repoData } = await octokit.rest.repos.get({
        owner: site.githubOwner,
        repo: site.githubRepo,
    })
    const defaultBranch2 = repoData.default_branch
    const { url, prNumber } = await createPullRequestSuggestion({
        files,
        octokit,
        owner: site.githubOwner,
        repo: site.githubRepo,
        branch: defaultBranch2,
        accountLogin: '',
        fork: false,
        title: chat.title || 'Update documentation',
        body:
            ('description' in chat
                ? (chat as { description?: string }).description
                : undefined) ?? 'Updated content from FumaBase assistant.',
    })
    await prisma.chat.update({
        where: { chatId, userId },
        data: {
            prNumber,
            lastPushedFiles: filesInDraft as Prisma.InputJsonValue,
        },
    })
    return { prUrl: url, action: 'created' }
}

export async function action({
    request,
    params: { chatId },
}: Route.ActionArgs) {
    const { userId } = await getSession({ request })
    const formData = await request.formData()
    const fumabaseJsonc = formData.get('fumabaseJsonc') as string | undefined

    const { prUrl } = await createPrSuggestionForChat({
        chatId,
        userId,
        fumabaseJsonc,
    })

    return redirect(prUrl)
}

export default function Page({ params }: Route.ComponentProps) {
    const submit = useSubmit()
    const { chatId } = params

    useEffect(() => {
        // Get persisted fumabase.jsonc from localStorage
        const persistedFumabase = localStorage.getItem(
            keyForDocsJsonFormLocalStorage({ chatId }),
        )

        // Submit form with fumabase.jsonc data
        const formData = new FormData()
        if (persistedFumabase) {
            formData.append('fumabaseJsonc', persistedFumabase)
        }

        submit(formData, { method: 'post' })
    }, [chatId, submit])

    return (
        <div className='flex h-screen flex-col items-center justify-center gap-4'>
            <Loader2Icon className='h-6 w-6 animate-spin' />
            <p>pushing files to GitHub PR</p>
        </div>
    )
}
