'use client'

import * as React from 'react'
import { useNavigate, useParams } from 'react-router'
import { href } from 'react-router'
import { RiAddLine } from '@remixicon/react'
import { ChevronsUpDownIcon, CheckIcon } from 'lucide-react'
import { Button } from './ui/button'
import { GithubIcon } from './icons'
import { cn } from 'website/src/lib/utils'
import { Popover, PopoverContent, PopoverTrigger } from 'website/src/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from 'website/src/components/ui/command'

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
  const navigate = useNavigate()
  const params = useParams()
  const { siteId: currentSiteId } = params
  const [open, setOpen] = React.useState(false)

  if (!sites.length) return <div className={className} />

  const activeSite = sites.find((site) => site.siteId === currentSiteId) || sites[0] || null

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className={className} asChild>
        <Button
          variant={'secondary'}
          role='combobox'
          aria-expanded={open}
          className='pl-1 max-w-[260px] data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground gap-3 [&>svg]:size-auto justify-between'
        >
          <div className='flex shrink-0 aspect-square items-center justify-center rounded-md overflow-hidden bg-sidebar-primary text-sidebar-primary-foreground relative after:rounded-[inherit] after:absolute after:inset-0 after:shadow-[0_1px_2px_0_rgb(0_0_0/.05),inset_0_1px_0_0_rgb(255_255_255/.12)] after:pointer-events-none'>
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
            <span className='truncate font-medium'>{activeSite?.name || activeSite?.org.name || 'Select a Site'}</span>
          </div>
          <ChevronsUpDownIcon className='ms-auto text-sidebar-foreground/50 h-4 w-4 shrink-0' aria-hidden='true' />
        </Button>
      </PopoverTrigger>
      <PopoverContent className='p-0 w-[260px]' align='start'>
        <Command>
          <CommandInput placeholder='Search sites...' className='h-9' />
          <CommandList>
            <CommandEmpty>No sites found.</CommandEmpty>
            <CommandGroup>
              {sites.map((site) => (
                <CommandItem
                  key={site.siteId}
                  value={`${site.siteId}-${site.name || site.org.name}`}
                  keywords={[site.name || '', site.org.name]}
                  onSelect={() => {
                    navigate(
                      href('/org/:orgId/site/:siteId', {
                        orgId: site.org.orgId,
                        siteId: site.siteId,
                      }),
                    )
                    setOpen(false)
                  }}
                  className='gap-2'
                >
                  <div className='flex size-6 items-center justify-center rounded-md overflow-hidden shrink-0'>
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
                  <span className='truncate'>{site.name || site.org.name}</span>
                  <CheckIcon
                    className={cn(
                      'ml-auto h-4 w-4 shrink-0',
                      currentSiteId === site.siteId ? 'opacity-100' : 'opacity-0',
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup>
              <CommandItem
                onSelect={() => {
                  navigate(
                    href('/org/:orgId/onboarding', {
                      orgId: activeSite?.org.orgId || sites[0]?.org.orgId,
                    }),
                  )
                  setOpen(false)
                }}
                className='gap-2'
              >
                <RiAddLine className='opacity-60 h-4 w-4' aria-hidden='true' />
                <span className='font-medium'>Create new site</span>
              </CommandItem>
              <CommandItem
                onSelect={() => {
                  navigate(
                    href('/org/:orgId/onboarding-from-github', {
                      orgId: activeSite?.org.orgId || sites[0]?.org.orgId,
                    }),
                  )
                  setOpen(false)
                }}
                className='gap-2'
              >
                <GithubIcon className='opacity-60 w-4 h-4' />
                <span className='font-medium'>New from GitHub</span>
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
