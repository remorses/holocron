'use client'

import * as React from 'react'
import { HistoryIcon, PlusIcon } from 'lucide-react'

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
import { ChatHistory } from './chat-history'
import { useRouteLoaderData, useParams } from 'react-router'
import { href } from 'react-router'
import type { Route } from 'website/src/routes/org.$orgId.site.$siteId.chat.$chatId'

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
    const loaderData = useRouteLoaderData(
        'routes/org.$orgId.site.$siteId.chat.$chatId',
    ) as Route.ComponentProps['loaderData']
    const params = useParams()
    const { orgId, siteId } = params
    const { viewChatHistory } = loaderData || {}

    return (
        <Sidebar
            variant='inset'
            {...props}
            className='dark flex h-full flex-col grow scheme-only-dark max-lg:p-3 p-4 pr-0'
        >
            <div
                className='grid grow h-full grid-rows-24 grid-cols-1 items-stretch gap-2'
                style={{ height: 'var(--sidebar-header-height, 64px)' }}
            >
                <div className='p-0 row-span-1 w-full flex items-center pr-4'>
                    <TeamSwitcher
                        className='w-auto'
                        teams={[
                            {
                                name: 'ArkDigital',
                                logo: 'https://raw.githubusercontent.com/origin-space/origin-images/refs/heads/main/exp2/logo-01_upxvqe.png',
                            },
                            {
                                name: 'Acme Corp.',
                                logo: 'https://raw.githubusercontent.com/origin-space/origin-images/refs/heads/main/exp2/logo-01_upxvqe.png',
                            },
                            {
                                name: 'Evil Corp.',
                                logo: 'https://raw.githubusercontent.com/origin-space/origin-images/refs/heads/main/exp2/logo-01_upxvqe.png',
                            },
                        ]}
                    />

                    <div className='grow'></div>
                    <div className='flex gap-2'>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant='secondary'
                                    size='icon'
                                    className='size-8'
                                    asChild
                                >
                                    <a
                                        href={`
                                          ${href(
                                              '/org/:orgId/site/:siteId/chat/:chatId',
                                              {
                                                  orgId: orgId!,
                                                  siteId: siteId!,
                                                  chatId: params.chatId!,
                                              },
                                          )}${viewChatHistory ? '' : '?viewChatHistory=true'}
                                      `}
                                    >
                                        <HistoryIcon />
                                    </a>
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                                {viewChatHistory ? 'Back to Chat' : 'History'}
                            </TooltipContent>
                        </Tooltip>

                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant='secondary'
                                    size='icon'
                                    className='size-8'
                                >
                                    <PlusIcon />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>New chat</TooltipContent>
                        </Tooltip>
                    </div>
                </div>

                <div className='p-0 grow row-span-23 flex flex-col '>
                    {viewChatHistory ? <ChatHistory /> : <Chat />}
                </div>
            </div>
        </Sidebar>
    )
}
