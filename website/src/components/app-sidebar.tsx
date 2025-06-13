'use client'

import * as React from 'react'

import { NavUser } from 'website/src/components/nav-user'
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarHeader,
} from 'website/src/components/ui/sidebar'
import { TeamSwitcher } from './team-switcher'
import Chat from './chat'

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
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
                <SidebarHeader className='p-0 row-span-1 flex items-center pr-4'>
                    <TeamSwitcher
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
                </SidebarHeader>
                <SidebarFooter className='p-0 row-span-23 flex items-center'>
                    <Chat />
                </SidebarFooter>
            </div>
        </Sidebar>
    )
}
