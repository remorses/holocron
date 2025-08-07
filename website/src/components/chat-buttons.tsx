import { memo, useMemo, useState } from 'react'
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
import { useLoaderData, useRevalidator, useRouteLoaderData } from 'react-router'
import { useChatContext } from 'contesto/src/chat/chat-provider'
import { useTemporaryState } from '../lib/hooks'
import { apiClient } from '../lib/spiceflow-client'
import { doFilesInDraftNeedPush, useWebsiteState } from '../lib/state'
import { cn } from '../lib/utils'
import type { Route } from '../routes/+types/org.$orgId.site.$siteId.chat.$chatId'
import type { Route as SiteRoute } from '../routes/org.$orgId.site.$siteId'
import { FileUpdate, calculateLineChanges } from 'docs-website/src/lib/edit-tool'
import { useQuery } from '@tanstack/react-query'

export function PrButton({ className = '' }) {
    const [isLoading, setIsLoading] = useState(false)
    const [errorMessage, setErrorMessage] = useState('')
    const [buttonText, setButtonText] = useTemporaryState('', 2000)
    const { messages, isGenerating: isChatGenerating } = useChatContext()

    const { chatId, chat, branchId } =
        useLoaderData() as Route.ComponentProps['loaderData']
    const siteData = useRouteLoaderData(
        'routes/org.$orgId.site.$siteId',
    ) as SiteRoute.ComponentProps['loaderData']
    const { siteId } = siteData

    const filesInDraft = useWebsiteState((x) => x?.filesInDraft || {})
    const lastPushedFiles = useWebsiteState((x) => x.lastPushedFiles)
    const hasNonPushedChanges = useMemo(() => {
        return doFilesInDraftNeedPush(filesInDraft, lastPushedFiles)
    }, [filesInDraft, lastPushedFiles])

    const revalidator = useRevalidator()

    // Only show if site has GitHub installation AND repository configured
    if (!siteData.site.githubInstallations?.length) return null
    if (!siteData.site.githubOwner || !siteData.site.githubRepo) return null

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

        // if (!hasNonPushedChanges) {
        //     return true
        // }
        return false
    })()

    const getTooltipMessage = (): string | null => {
        if (!hasNonPushedChanges) {
            return 'No unsaved changes to create PR'
        }
        if (isChatGenerating) {
            return 'Wait for chat to finish generating'
        }
        if (isLoading) {
            return 'Creating PR...'
        }
        if (errorMessage) {
            return 'Fix error before creating PR'
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
        if (chat.prNumber) {
            return `Push to PR #${chat.prNumber}`
        }
        return 'Create Github PR'
    })()

    const handleCreatePr = async () => {
        setIsLoading(true)
        try {
            const filesInDraft = useWebsiteState.getState()?.filesInDraft || {}

            const result = await apiClient.api.createPrSuggestionForChat.post({
                branchId,
                filesInDraft,
                chatId,
            })
            if (result.error) throw result.error

            await revalidator.revalidate()
            setButtonText('PR submitted')
        } catch (error) {
            console.error('Failed to create PR:', error)
            const message =
                error instanceof Error ? error.message : 'Failed to create PR'
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
                                    variant='default'
                                    onClick={handleCreatePr}
                                    disabled={isButtonDisabled}
                                    size={'sm'}
                                    className='bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-50'
                                >
                                    <div className='flex items-center gap-2'>
                                        <GitBranch className='size-4' />
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

export function SaveChangesButton({ className = '' }) {
    const [isLoading, setIsLoading] = useState(false)
    const [errorMessage, setErrorMessage] = useState('')
    const [buttonText, setButtonText] = useTemporaryState('', 2000)
    const { messages, isGenerating: isChatGenerating } = useChatContext()

    const { chatId, branchId } =
        useLoaderData() as Route.ComponentProps['loaderData']
    const siteData = useRouteLoaderData(
        'routes/org.$orgId.site.$siteId',
    ) as SiteRoute.ComponentProps['loaderData']

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
    const { branchId } = useLoaderData() as Route.ComponentProps['loaderData']

    const { data: resolvedStats = [] } = useQuery({
        queryKey: ['diffStats', branchId, filesInDraft],
        queryFn: async () => {
            const getPageContent = async (githubPath: string) => {
                const { data, error } = await apiClient.api.getPageContent.post({
                    branchId,
                    githubPath,
                })
                if (error) return ''
                return data?.content || ''
            }

            const computeStatsForFile = async (file: FileUpdate) => {
                const originalContent = await getPageContent(file.githubPath)
                const currentContent = file.content || ''
                return calculateLineChanges(originalContent, currentContent)
            }

            const statsPromises = Object.entries(filesInDraft).map(async ([path, file]) => {
                const stats = await computeStatsForFile(file)
                return {
                    path,
                    file,
                    addedLines: stats.addedLines,
                    deletedLines: stats.deletedLines,
                }
            })

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
