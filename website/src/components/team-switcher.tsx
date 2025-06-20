'use client'

import * as React from 'react'
import { useNavigate, useParams } from 'react-router'
import { href } from 'react-router'

import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuShortcut,
    DropdownMenuTrigger,
} from 'website/src/components/ui/dropdown-menu'
import {
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from 'website/src/components/ui/sidebar'
import { RiExpandUpDownLine, RiAddLine } from '@remixicon/react'

export function TeamSwitcher({
    teams,
    className = '',
}: {
    teams: {
        name: string
        logo: string
        orgId?: string
    }[]
    className?: string
}) {
    const navigate = useNavigate()
    const params = useParams()
    const { orgId: currentOrgId } = params

    const activeTeam =
        teams.find((team) => team.orgId === currentOrgId) || teams[0] || null

    if (!teams.length) return null

    return (
        <DropdownMenu>
            <DropdownMenuTrigger className={className} asChild>
                <SidebarMenuButton
                    size='lg'
                    className='data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground gap-3 [&>svg]:size-auto'
                >
                    <div className='flex aspect-square size-9 items-center justify-center rounded-md overflow-hidden bg-sidebar-primary text-sidebar-primary-foreground relative after:rounded-[inherit] after:absolute after:inset-0 after:shadow-[0_1px_2px_0_rgb(0_0_0/.05),inset_0_1px_0_0_rgb(255_255_255/.12)] after:pointer-events-none'>
                        {activeTeam && (
                            <img
                                src={activeTeam.logo}
                                width={36}
                                height={36}
                                alt={activeTeam.name}
                            />
                        )}
                    </div>
                    <div className='grid flex-1 text-left text-base leading-tight'>
                        <span className='truncate font-medium'>
                            {activeTeam?.name ?? 'Select a Team'}
                        </span>
                    </div>
                    <RiExpandUpDownLine
                        className='ms-auto text-sidebar-foreground/50'
                        size={20}
                        aria-hidden='true'
                    />
                </SidebarMenuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent
                className='dark w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-md'
                align='start'
                side='bottom'
                sideOffset={4}
            >
                <DropdownMenuLabel className='uppercase text-muted-foreground/70 text-xs'>
                    Teams
                </DropdownMenuLabel>
                {teams.map((team, index) => (
                    <DropdownMenuItem
                        key={team.orgId || team.name}
                        onClick={() => {
                            if (team.orgId && team.orgId !== currentOrgId) {
                                navigate(href('/org/:orgId', { orgId: team.orgId }))
                            }
                        }}
                        className='gap-2 p-2'
                    >
                        <div className='flex size-6 items-center justify-center rounded-md overflow-hidden'>
                            <img
                                src={team.logo}
                                width={36}
                                height={36}
                                alt={team.name}
                            />
                        </div>
                        {team.name}
                        <DropdownMenuShortcut>
                            ⌘{index + 1}
                        </DropdownMenuShortcut>
                    </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem className='gap-2 p-2'>
                    <RiAddLine
                        className='opacity-60'
                        size={16}
                        aria-hidden='true'
                    />
                    <div className='font-medium'>Add team</div>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
