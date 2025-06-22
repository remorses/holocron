'use client'

import * as React from 'react'
import { useNavigation, useParams, Link } from 'react-router'
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
import { Button } from './ui/button'

export function TeamSwitcher({
    sites,
    className = '',
}: {
    sites: {
        name: string | null
        siteId: string
        customization?: {
            logoUrl?: string | null
        } | null
        org: {
            orgId: string
            name: string
            image?: string | null
        }
    }[]
    className?: string
}) {
    const navigation = useNavigation()
    const params = useParams()
    const { siteId: currentSiteId } = params

    const activeSite =
        sites.find((site) => site.siteId === currentSiteId) || sites[0] || null

    if (!sites.length) return null

    return (
        <DropdownMenu>
            <DropdownMenuTrigger className={className} asChild>
                <Button
                    variant={'secondary'}
                    className='pl-1 grow-0 data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground gap-3 [&>svg]:size-auto'
                >
                    <div className='flex aspect-square items-center justify-center rounded-md overflow-hidden bg-sidebar-primary text-sidebar-primary-foreground relative after:rounded-[inherit] after:absolute after:inset-0 after:shadow-[0_1px_2px_0_rgb(0_0_0/.05),inset_0_1px_0_0_rgb(255_255_255/.12)] after:pointer-events-none'>
                        {activeSite && (
                            <img
                                src={
                                    activeSite.org.image ||
                                    `https://avatar.vercel.sh/${encodeURIComponent(activeSite.name || activeSite.org.name)}?gradient=linear`
                                }
                                width={26}
                                height={26}
                                alt={activeSite.name || activeSite.org.name}
                            />
                        )}
                    </div>
                    <div className='grid flex-1 text-left leading-tight'>
                        <span className='truncate font-medium'>
                            {activeSite?.name ||
                                activeSite?.org.name ||
                                'Select a Site'}
                        </span>
                    </div>
                    <RiExpandUpDownLine
                        className='ms-auto text-sidebar-foreground/50'
                        size={18}
                        aria-hidden='true'
                    />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
                className='dark w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-md'
                align='start'
                side='bottom'
                sideOffset={4}
            >
                <DropdownMenuLabel className='uppercase text-muted-foreground/70 text-xs'>
                    Sites
                </DropdownMenuLabel>
                {sites.map((site, index) => (
                    <DropdownMenuItem
                        key={site.siteId}
                        className='gap-2 p-2'
                        asChild
                    >
                        <Link
                            to={href('/org/:orgId/site/:siteId', {
                                orgId: site.org.orgId,
                                siteId: site.siteId,
                            })}
                        >
                            <div className='flex size-6 items-center justify-center rounded-md overflow-hidden'>
                                <img
                                    src={
                                        site.org.image ||
                                        `https://avatar.vercel.sh/${encodeURIComponent(site.name || site.org.name)}?gradient=linear`
                                    }
                                    width={24}
                                    height={24}
                                    alt={site.name || site.org.name}
                                />
                            </div>
                            {site.name || site.org.name}
                            {navigation.state === 'loading' ? (
                                <div className='ml-auto text-xs text-muted-foreground'>
                                    Loading...
                                </div>
                            ) : (
                                <DropdownMenuShortcut>
                                    ⌘{index + 1}
                                </DropdownMenuShortcut>
                            )}
                        </Link>
                    </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem className='gap-2 p-2' asChild>
                    <Link
                        to={href('/org/:orgId/onboarding', {
                            orgId: activeSite?.org.orgId || sites[0]?.org.orgId,
                        })}
                    >
                        <RiAddLine
                            className='opacity-60'
                            size={16}
                            aria-hidden='true'
                        />
                        <div className='font-medium'>Add site</div>
                    </Link>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
