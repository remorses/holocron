'use client'

import { MessageSquare, Clock } from 'lucide-react'
import { useRouteLoaderData } from 'react-router'
import { href } from 'react-router'
import { ScrollArea } from './ui/scroll-area'
import { Button } from './ui/button'
import type { Route } from 'website/src/routes/org.$orgId.site.$siteId.chat.$chatId'

export function ChatHistory({}) {
    const loaderData = useRouteLoaderData(
        'routes/org.$orgId.site.$siteId.chat.$chatId',
    ) as Route.ComponentProps['loaderData']
    const { chatHistory, chat, site } = loaderData

    if (!chatHistory.length) {
        return (
            <div className='flex flex-col items-center justify-center h-full text-muted-foreground'>
                <MessageSquare className='h-12 w-12 mb-4 opacity-50' />
                <p className='text-sm'>No chat history found</p>
            </div>
        )
    }

    return (
        <ScrollArea className='h-full'>
            <div className='flex flex-col gap-2 p-2'>
                <div className='flex items-center gap-2 mb-4 px-2'>
                    <Clock className='h-4 w-4' />
                    <span className='font-medium text-sm'>Chat History</span>
                </div>

                {chatHistory.map((chat) => (
                    <Button
                        key={chat.chatId}
                        variant='ghost'
                        className='flex flex-col items-start justify-start h-auto p-3 text-left'
                        asChild
                    >
                        <a
                            href={href(
                                '/org/:orgId/site/:siteId/chat/:chatId',
                                {
                                    orgId: site.orgId,
                                    siteId: site.siteId,
                                    chatId: chat.chatId,
                                },
                            )}
                        >
                            <div className='flex items-center gap-2 w-full'>
                                <MessageSquare className='h-4 w-4 flex-shrink-0' />
                                <div className='flex-1 min-w-0'>
                                    <div className='font-medium text-sm truncate'>
                                        {chat.title || 'Untitled Chat'}
                                    </div>
                                    <div className='text-xs text-muted-foreground'>
                                        {new Date(
                                            chat.createdAt,
                                        ).toLocaleDateString()}
                                    </div>
                                </div>
                            </div>
                        </a>
                    </Button>
                ))}
            </div>
        </ScrollArea>
    )
}
