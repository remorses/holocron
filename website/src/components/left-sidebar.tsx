'use client'

import * as React from 'react'
import { HistoryIcon, PlusIcon, Loader2, ChevronDown } from 'lucide-react'

import { NavUser } from 'website/src/components/nav-user'
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuItem,
} from 'website/src/components/ui/sidebar'
import { TeamSwitcher } from './team-switcher'
import Chat from './chat'
import { Button } from './ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip'
import { Combobox } from './ui/combobox'
import { Badge } from './ui/badge'
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover'
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandItem,
    CommandList,
    CommandInput,
} from './ui/command'
import { useRouteLoaderData, useParams, useNavigate } from 'react-router'
import { href } from 'react-router'
import type { Route as SiteRoute } from 'website/src/routes/org.$orgId.site.$siteId'
import type { Route as OrgRoute } from 'website/src/routes/org.$orgId'
import type { Route as ChatRoute } from 'website/src/routes/org.$orgId.site.$siteId.chat.$chatId._index'
import { apiClient } from 'website/src/lib/spiceflow-client'
import { useStickToBottom } from 'use-stick-to-bottom'
import { useShouldHideBrowser } from '../lib/hooks'

function ChatCombobox({ chatId }: { chatId?: string }) {
    const siteData = useRouteLoaderData(
        'routes/org.$orgId.site.$siteId',
    ) as SiteRoute.ComponentProps['loaderData']
    const params = useParams()
    const navigate = useNavigate()
    const { orgId, siteId } = params
    const { chatHistory } = siteData

    const chatHistoryItems = chatHistory.map((chat) => ({
        value: chat.chatId,
        label: chat.title || 'Untitled Chat',
        branch: chat.branch.githubBranch,
    }))

    return (
        <Combobox
            value={chatId}
            onValueChange={(value) => {
                if (value && value !== chatId) {
                    navigate(
                        href('/org/:orgId/site/:siteId/chat/:chatId', {
                            orgId: orgId!,
                            siteId: siteId!,
                            chatId: value,
                        }),
                    )
                }
            }}
            placeholder='Select chat...'
            searchPlaceholder='Search chats...'
            emptyText='No chats found.'
            className='min-w-0 truncate max-w-[200px] font-medium'
            items={chatHistoryItems}
        />
    )
}

function NewChatButton() {
    const siteData = useRouteLoaderData(
        'routes/org.$orgId.site.$siteId',
    ) as SiteRoute.ComponentProps['loaderData']
    const params = useParams()
    const navigate = useNavigate()
    const { orgId, siteId } = params
    const [open, setOpen] = React.useState(false)
    const [isCreatingChat, setIsCreatingChat] = React.useState(false)
    const { siteBranches } = siteData

    const handleNewChat = async (branchId: string) => {
        if (!orgId || !siteId || isCreatingChat) return

        setIsCreatingChat(true)
        setOpen(false)

        try {
            const { data, error } = await apiClient.api.newChat.post({
                orgId,
                branchId,
            })

            if (error) {
                console.error('Error creating new chat:', error)
                return
            }

            if (data?.success && data.chatId) {
                navigate(
                    href('/org/:orgId/site/:siteId/chat/:chatId', {
                        orgId,
                        siteId,
                        chatId: data.chatId,
                    }),
                )
            }
        } catch (error) {
            console.error('Failed to create new chat:', error)
        } finally {
            setIsCreatingChat(false)
        }
    }

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <Tooltip>
                <TooltipTrigger asChild>
                    <PopoverTrigger
                        onClick={(e) => {
                            if (siteBranches.length <= 1) {
                                e.stopPropagation()
                                e.preventDefault()
                                handleNewChat(siteBranches[0]?.branchId!)
                            }
                        }}
                        asChild
                    >
                        <Button
                            variant='secondary'
                            className='flex items-center gap-1 px-3'
                            disabled={isCreatingChat}
                        >
                            {isCreatingChat ? (
                                <Loader2 className='h-4 w-4 animate-spin' />
                            ) : (
                                <PlusIcon className='h-4 w-4' />
                            )}
                            <ChevronDown className='h-3 w-3' />
                        </Button>
                    </PopoverTrigger>
                </TooltipTrigger>
                <TooltipContent>
                    {isCreatingChat ? 'Creating new chat...' : 'New chat'}
                </TooltipContent>
            </Tooltip>
            <PopoverContent className='p-0 w-56' align='start'>
                <Command>
                    <CommandInput
                        placeholder='Search branches...'
                        className='h-9'
                    />
                    <CommandList>
                        <CommandEmpty>No branches found.</CommandEmpty>
                        <CommandGroup>
                            {siteBranches.map((branch) => (
                                <CommandItem
                                    key={branch.branchId}
                                    value={branch.githubBranch}
                                    onSelect={() => {
                                        handleNewChat(branch.branchId)
                                    }}
                                    className='max-w-full cursor-pointer'
                                >
                                    <span className='truncate'>
                                        New chat in {branch.githubBranch}
                                    </span>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    )
}
export function ChatLeftSidebar({
    ...props
}: React.ComponentProps<typeof Sidebar>) {
    const hideBrowser = useShouldHideBrowser()
    const orgData = useRouteLoaderData(
        'routes/org.$orgId',
    ) as OrgRoute.ComponentProps['loaderData']

    const params = useParams()
    const { chatId } = params
    const { userSites } = orgData

    const overflowDivRef = React.useRef<HTMLDivElement>(null)

    return (
        <div
            {...props}
            style={{
                width: hideBrowser ? '100%' : '500px',
                ...(hideBrowser && {
                    paddingLeft: '2px',
                    paddingRight: '2px',
                }),
            }}
            className='dark mx-auto bg-black h-full flex-col scheme-only-dark px-0 grid max-w-full min-h-full grid-rows-24 grid-cols-1 items-stretch gap-2'
        >
            <div className='justify-between max-w-[900px] w-full mx-auto row-span-1 z-10 gap-2 pr-2 flex'>
                <TeamSwitcher className='grow ' sites={userSites} />

                <div className='flex items-start gap-2'>
                    <ChatCombobox chatId={chatId} />
                    <NewChatButton />
                </div>
            </div>

            <div
                ref={overflowDivRef}
                className='grow relative overflow-y-auto items-center overflow-x-hidden w-full row-span-23 flex flex-col '
            >
                <Chat />
            </div>
        </div>
    )
}
