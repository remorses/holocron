'use client'

import * as React from 'react'
import { HistoryIcon, PlusIcon, Loader2 } from 'lucide-react'

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
import { useRouteLoaderData, useParams, useNavigate } from 'react-router'
import { href } from 'react-router'
import type { Route } from 'website/src/routes/org.$orgId.site.$siteId.chat.$chatId'
import { apiClient } from 'website/src/lib/spiceflow-client'

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
    const loaderData = useRouteLoaderData(
        'routes/org.$orgId.site.$siteId.chat.$chatId',
    ) as Route.ComponentProps['loaderData']
    const params = useParams()
    const navigate = useNavigate()
    const { orgId, siteId, chatId } = params
    const { chatHistory, userSites } = loaderData
    const [isCreatingChat, setIsCreatingChat] = React.useState(false)

    const handleNewChat = async () => {
        if (!orgId || !siteId || isCreatingChat) return

        setIsCreatingChat(true)

        try {
            const { data, error } = await apiClient.api.newChat.post({
                orgId,
                siteId,
            })

            if (error) {
                console.error('Error creating new chat:', error)
                // You could add a toast notification here
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
            // You could add a toast notification here
        } finally {
            setIsCreatingChat(false)
        }
    }

    const chatHistoryItems = chatHistory.map((chat) => ({
        value: chat.chatId,
        label: chat.title || 'Untitled Chat',
    }))

    return (
        <Sidebar
            variant='inset'
            {...props}
            className='dark flex h-full flex-col grow scheme-only-dark max-lg:p-3 p-4 pr-0'
        >
            <div
                className='grid grow h-full grid-rows-24 grid-cols-1 items-stretch gap-2'
                // style={{ height: 'var(--sidebar-header-height, 64px)' }}
            >
                <div className='p-0 justify-between row-span-1 gap-2 w-full flex   pr-4'>
                    <TeamSwitcher className='w-auto grow-0' sites={userSites} />


                    <div className='grid  grid-cols-[minmax(0,auto)_minmax(0,1fr)] gap-2'>
                        <div className=''>
                            <Combobox
                                value={chatId}
                                onValueChange={(value) => {
                                    if (value && value !== chatId) {
                                        navigate(
                                            href(
                                                '/org/:orgId/site/:siteId/chat/:chatId',
                                                {
                                                    orgId: orgId!,
                                                    siteId: siteId!,
                                                    chatId: value,
                                                },
                                            ),
                                        )
                                    }
                                }}
                                placeholder='Select chat...'
                                searchPlaceholder='Search chats...'
                                emptyText='No chats found.'
                                className='max-w-[200px] text-sm'
                                items={chatHistoryItems}
                            />
                        </div>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant='secondary'
                                    size='icon'
                                    onClick={handleNewChat}
                                    disabled={isCreatingChat}
                                >
                                    {isCreatingChat ? (
                                        <Loader2 className='h-4 w-4 animate-spin' />
                                    ) : (
                                        <PlusIcon />
                                    )}
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                                {isCreatingChat
                                    ? 'Creating new chat...'
                                    : 'New chat'}
                            </TooltipContent>
                        </Tooltip>
                    </div>
                </div>

                <div className='p-0 grow row-span-23 flex flex-col '>
                    <Chat />
                </div>
            </div>
        </Sidebar>
    )
}
