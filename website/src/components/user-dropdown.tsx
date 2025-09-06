import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from 'website/src/components/ui/avatar'
import { Button } from 'website/src/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from 'website/src/components/ui/dropdown-menu'

import {
  RiLogoutCircleLine,
  RiTimer2Line,
  RiUserLine,
  RiFindReplaceLine,
  RiPulseLine,
} from '@remixicon/react'

export default function UserDropdown() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant='ghost' className='h-auto p-0 hover:bg-transparent'>
          <Avatar className='size-8'>
            <AvatarImage
              src='https://raw.githubusercontent.com/origin-space/origin-images/refs/heads/main/exp2/user-02_mlqqqt.png'
              width={32}
              height={32}
              alt='Profile image'
            />
            <AvatarFallback>KK</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className='max-w-64 p-2' align='end'>
        <DropdownMenuLabel className='flex min-w-0 flex-col py-0 px-1 mb-2'>
          <span className='truncate text-sm font-medium text-foreground mb-0.5'>
            Mary P.
          </span>
          <span className='truncate text-xs font-normal text-muted-foreground'>
            mary@askdigital.com
          </span>
        </DropdownMenuLabel>
        <DropdownMenuItem className='gap-3 px-1'>
          <RiTimer2Line
            size={20}
            className='text-muted-foreground/70'
            aria-hidden='true'
          />
          <span>Dashboard</span>
        </DropdownMenuItem>
        <DropdownMenuItem className='gap-3 px-1'>
          <RiUserLine
            size={20}
            className='text-muted-foreground/70'
            aria-hidden='true'
          />
          <span>Profile</span>
        </DropdownMenuItem>
        <DropdownMenuItem className='gap-3 px-1'>
          <RiPulseLine
            size={20}
            className='text-muted-foreground/70'
            aria-hidden='true'
          />
          <span>Changelog</span>
        </DropdownMenuItem>
        <DropdownMenuItem className='gap-3 px-1'>
          <RiFindReplaceLine
            size={20}
            className='text-muted-foreground/70'
            aria-hidden='true'
          />
          <span>History</span>
        </DropdownMenuItem>
        <DropdownMenuItem className='gap-3 px-1'>
          <RiLogoutCircleLine
            size={20}
            className='text-muted-foreground/70'
            aria-hidden='true'
          />
          <span>Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
