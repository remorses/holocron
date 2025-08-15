import { memo, useMemo, useState, useCallback } from 'react'
import { Button } from 'website/src/components/ui/button'
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from 'website/src/components/ui/popover'
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from 'website/src/components/ui/tooltip'
import { AlertCircle, GitBranch, Save, X } from 'lucide-react'
import {
    Link,
    useLoaderData,
    useRevalidator,
    useRouteLoaderData,
} from 'react-router'
import { href } from 'react-router'
import { useChatContext } from 'contesto/src/chat/chat-provider'
import { useTemporaryState } from '../lib/hooks'
import { apiClient } from '../lib/spiceflow-client'
import { doFilesInDraftNeedPush, useWebsiteState } from '../lib/state'
import { cn } from '../lib/utils'

import type { Route as SiteRoute } from '../routes/org.$orgId.site.$siteId'
import {
    FileUpdate,
    calculateLineChanges,
} from 'docs-website/src/lib/edit-tool'
import { useQuery } from '@tanstack/react-query'

export function PrButton({ className = '' }) {
    const { messages, isGenerating: isChatGenerating } = useChatContext()
    const { chatId, chat, prUrl } =
        useLoaderData<
            typeof import('../routes/org.$orgId.site.$siteId.chat.$chatId._index').loader
        >()
    const siteData = useRouteLoaderData<
        typeof import('../routes/org.$orgId.site.$siteId').loader
    >('routes/org.$orgId.site.$siteId')!
    const [isUpdating, setIsUpdating] = useState(false)

    const { siteId } = siteData
    const orgId = siteData.site.org.orgId

    const filesInDraft = useWebsiteState((x) => x?.filesInDraft || {})
    const lastPushedFiles = useWebsiteState((x) => x.lastPushedFiles)
    const hasNonPushedChanges = useMemo(() => {
        return doFilesInDraftNeedPush(filesInDraft, lastPushedFiles)
    }, [filesInDraft, lastPushedFiles])



    const prHref = href('/org/:orgId/site/:siteId/chat/:chatId/create-pr', {
        orgId,
        siteId,
        chatId,
    })

    const handlePrClick = useCallback(
        async (e: React.MouseEvent<HTMLAnchorElement>) => {
            e.preventDefault()
            setIsUpdating(true)

            try {
                const currentFilesInDraft =
                    useWebsiteState.getState().filesInDraft
                const { data, error } =
                    await apiClient.api.updateChatFilesInDraft.post({
                        chatId,
                        filesInDraft: currentFilesInDraft,
                    })

                if (error) {
                    console.error(
                        'Failed to update filesInDraft before PR:',
                        error,
                    )
                }

                // Navigate to PR page (create or push)
                window.open(prHref, '_blank')
            } catch (error) {
                console.error('Failed to update filesInDraft:', error)
            } finally {
                setIsUpdating(false)
            }
        },
        [hasNonPushedChanges, chat.prNumber, chatId, prHref],
    )

    const { to, text, isButtonDisabled, tooltipMessage } = (() => {
        if (isUpdating) {
            return {
                to: prHref,
                text: 'Updating...',
                isButtonDisabled: true,
                tooltipMessage: 'Saving changes to database',
            }
        }
        if (chat.prNumber) {
            if (!hasNonPushedChanges) {
                return {
                    to: prUrl || '',
                    text: 'Show PR',
                    isButtonDisabled: false,
                    tooltipMessage: null,
                }
            }
            if (isChatGenerating) {
                return {
                    to: prHref,
                    text: `Push to PR #${chat.prNumber}`,
                    isButtonDisabled: true,
                    tooltipMessage: 'Wait for chat to finish generating',
                }
            }
            return {
                to: prHref,
                text: `Push to PR #${chat.prNumber}`,
                isButtonDisabled: false,
                tooltipMessage: null,
            }
        }
        if (!hasNonPushedChanges) {
            return {
                to: prHref,
                text: 'Create Github PR',
                isButtonDisabled: true,
                tooltipMessage: 'No unsaved changes to create PR',
            }
        }
        if (isChatGenerating) {
            return {
                to: prHref,
                text: 'Create Github PR',
                isButtonDisabled: true,
                tooltipMessage: 'Wait for chat to finish generating',
            }
        }
        return {
            to: prHref,
            text: 'Create Github PR',
            isButtonDisabled: false,
            tooltipMessage: null,
        }
    })()

    if (!siteData) return null
    if (!siteData.site.githubInstallations?.length) return null
    if (!siteData.site.githubOwner || !siteData.site.githubRepo) return null
    if (!messages?.length) return null

    return (
        <div className={cn('flex items-center gap-2', className)}>
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button
                        variant='default'
                        size={'sm'}
                        className='bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-50'
                        disabled={isButtonDisabled}
                        asChild
                    >
                        <Link
                            to={to}
                            target='_blank'
                            rel='noreferrer'
                            onClick={handlePrClick}
                        >
                            <div className='flex items-center gap-2'>
                                <GitBranch className='size-4' />
                                {text}
                            </div>
                        </Link>
                    </Button>
                </TooltipTrigger>
                {tooltipMessage && (
                    <TooltipContent>{tooltipMessage}</TooltipContent>
                )}
            </Tooltip>
        </div>
    )
}

export function SaveChangesButton({ className = '' }) {
    const [isLoading, setIsLoading] = useState(false)
    const [errorMessage, setErrorMessage] = useState('')
    const [buttonText, setButtonText] = useTemporaryState('', 2000)
    const { messages, isGenerating: isChatGenerating } = useChatContext()

    const { chatId, branchId } =
        useLoaderData<
            typeof import('../routes/org.$orgId.site.$siteId.chat.$chatId._index').loader
        >()
    const siteData = useRouteLoaderData<
        typeof import('../routes/org.$orgId.site.$siteId').loader
    >('routes/org.$orgId.site.$siteId')
    if (!siteData) return null

    const filesInDraft = useWebsiteState((x) => x?.filesInDraft || {})
    const lastPushedFiles = useWebsiteState((x) => x.lastPushedFiles)
    const hasNonPushedChanges = useMemo(() => {
        return doFilesInDraftNeedPush(filesInDraft, lastPushedFiles)
    }, [filesInDraft, lastPushedFiles])

    const revalidator = useRevalidator()

    // Only show if site has NO GitHub installation
    if (!!siteData.site.githubInstallations?.length) return null

    // Only show if there are files in draft with content
    const hasFilesWithContent = Object.values(filesInDraft).some((file) =>
        file?.content?.trim(),
    )
    if (!hasFilesWithContent) return null

    const isButtonDisabled: boolean = (() => {
        if (isLoading) {
            return true
        }
        if (isChatGenerating) {
            return true
        }
        if (errorMessage) {
            return true
        }

        return false
    })()

    const getTooltipMessage = (): string | null => {
        if (!hasNonPushedChanges) {
            return 'No unsaved changes'
        }
        if (isChatGenerating) {
            return 'Wait for chat to finish generating'
        }
        if (isLoading) {
            return 'Saving changes...'
        }
        if (errorMessage) {
            return 'Fix error before saving'
        }
        return null
    }

    const displayButtonText: string = (() => {
        if (buttonText) {
            return buttonText
        }
        if (isLoading) {
            return 'loading...'
        }
        return 'Save Changes'
    })()

    const handleSaveChanges = async () => {
        setIsLoading(true)
        try {
            const filesInDraft = useWebsiteState.getState()?.filesInDraft || {}

            const result = await apiClient.api.saveChangesForChat.post({
                branchId,
                filesInDraft,
                chatId,
            })
            if (result.error) throw result.error

            await revalidator.revalidate()
            setButtonText('Changes saved')
        } catch (error) {
            console.error('Failed to save changes:', error)
            const message =
                error instanceof Error
                    ? error.message
                    : 'Failed to save changes'
            setErrorMessage(message)
        } finally {
            setIsLoading(false)
        }
    }
    if (!messages?.length) return null

    return (
        <div className={cn('flex items-center gap-2', className)}>
            <Popover
                onOpenChange={(x) => {
                    if (!x) setErrorMessage('')
                }}
                open={!!errorMessage}
            >
                <PopoverTrigger asChild>
                    <div className=''>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    // variant='secondary'
                                    onClick={handleSaveChanges}
                                    disabled={isButtonDisabled}
                                    size={'sm'}
                                    className='disabled:opacity-50'
                                >
                                    <div className='flex items-center gap-2'>
                                        <Save className='size-4' />
                                        {displayButtonText}
                                    </div>
                                </Button>
                            </TooltipTrigger>
                            {Boolean(
                                isButtonDisabled && getTooltipMessage(),
                            ) && (
                                <TooltipContent>
                                    {getTooltipMessage()}
                                </TooltipContent>
                            )}
                        </Tooltip>
                    </div>
                </PopoverTrigger>

                {!!errorMessage && (
                    <div
                        style={{
                            pointerEvents: 'auto',
                        }}
                        className='fixed inset-0 z-50 bg-black/20 transition-all duration-100'
                    />
                )}

                <PopoverContent className='w-full min-w-[200px] z-50 max-w-[400px]'>
                    <div className='flex items-start gap-3 '>
                        <AlertCircle className='size-5 text-destructive mt-0.5 flex-shrink-0' />
                        <div className='grow'>
                            <h4 className='font-medium  mb-1'>Error</h4>
                            <p className=' '>{errorMessage}</p>
                        </div>
                        <Button
                            variant='ghost'
                            size='sm'
                            className='p-1 h-auto hover:text-destructive hover:bg-destructive/10'
                            onClick={() => setErrorMessage('')}
                        >
                            <X className='size-4' />
                        </Button>
                    </div>
                </PopoverContent>
            </Popover>
        </div>
    )
}

interface DiffStatsProps {
    filesInDraft: Record<string, FileUpdate>
    hasNonPushedChanges?: boolean
    className?: string
}

export const DiffStats = memo(function DiffStats({
    filesInDraft,
    className = '',
}: DiffStatsProps) {
    const { branchId } =
        useLoaderData<
            typeof import('../routes/org.$orgId.site.$siteId.chat.$chatId._index').loader
        >()

    const { data: resolvedStats = [] } = useQuery({
        queryKey: ['diffStats', branchId, filesInDraft],
        queryFn: async () => {
            const getPageContent = async (githubPath: string) => {
                const { data, error } = await apiClient.api.getPageContent.post(
                    {
                        branchId,
                        githubPath,
                    },
                )
                if (error) return ''
                return data?.content || ''
            }

            const computeStatsForFile = async (file: FileUpdate) => {
                const originalContent = await getPageContent(file.githubPath)
                const currentContent = file.content || ''
                return calculateLineChanges(originalContent, currentContent)
            }

            const statsPromises = Object.entries(filesInDraft).map(
                async ([path, file]) => {
                    const stats = await computeStatsForFile(file)
                    return {
                        path,
                        file,
                        addedLines: stats.addedLines,
                        deletedLines: stats.deletedLines,
                    }
                },
            )

            return Promise.all(statsPromises)
        },
    })

    // Only include files that have additions or deletions
    const changedFiles = resolvedStats.filter(
        ({ addedLines, deletedLines }) => addedLines > 0 || deletedLines > 0,
    )
    const fileCount = changedFiles.length

    // Don't render if no files have diff
    if (fileCount === 0) {
        return null
    }

    const totalAdded = changedFiles.reduce(
        (sum, { addedLines }) => sum + addedLines,
        0,
    )
    const totalDeleted = changedFiles.reduce(
        (sum, { deletedLines }) => sum + deletedLines,
        0,
    )

    return (
        <div
            className={`text-xs flex gap-2 text-muted-foreground px-2 py-1 rounded-md ${className}`}
        >
            <div>
                edited <span className='font-medium'>{fileCount}</span> file
                {fileCount !== 1 ? 's' : ''}
            </div>
            <div>
                <>
                    {' '}
                    <span className='text-green-600 font-medium'>
                        +{totalAdded || 0}
                    </span>
                </>

                <>
                    ,{' '}
                    <span className='text-red-600 font-medium'>
                        -{totalDeleted}
                    </span>
                </>
            </div>
        </div>
    )
})
