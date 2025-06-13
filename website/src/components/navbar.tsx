import { Button } from 'website/src/components/ui/button'
import {
    NavigationMenu,
    NavigationMenuItem,
    NavigationMenuLink,
    NavigationMenuList,
} from 'website/src/components/ui/navigation-menu'
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from 'website/src/components/ui/popover'
import { useThrowingFn } from '../lib/hooks'
import { apiClient } from '../lib/spiceflow-client'
import { useParams } from 'react-router'

// Navigation links array to be used in both desktop and mobile menus
const navigationLinks = [
    { href: '#', label: 'Home', active: true },
    { href: '#', label: 'Features' },
    { href: '#', label: 'Pricing' },
    { href: '#', label: 'About' },
]

function Logo() {
    return (
        <svg
            width='28'
            height='28'
            viewBox='0 0 28 28'
            fill='none'
            xmlns='http://www.w3.org/2000/svg'
            aria-label='Logo'
        >
            <rect width='28' height='28' rx='6' fill='#6366F1' />
            <path
                d='M8 18V10C8 9.44772 8.44772 9 9 9H19C19.5523 9 20 9.44772 20 10V18C20 18.5523 19.5523 19 19 19H9C8.44772 19 8 18.5523 8 18Z'
                fill='white'
            />
            <path
                d='M11 14.5C11 13.1193 12.1193 12 13.5 12C14.8807 12 16 13.1193 16 14.5C16 15.8807 14.8807 17 13.5 17C12.1193 17 11 15.8807 11 14.5Z'
                fill='#6366F1'
            />
        </svg>
    )
}

export default function NavBar() {
    const { siteId } = useParams()
    const { fn: sync, isLoading } = useThrowingFn({
        async fn() {
            const { data, error } = await apiClient.api.githubSync.post({
                siteId: siteId!,
            })
            if (error) throw error
        },
    })
    return (
        <header className=''>
            <div className='flex h-16 items-center justify-between gap-4'>
                {/* Left side */}
                <div className='flex items-center gap-2'>
                    {/* Main nav */}
                    <div className='flex items-center gap-6'>
                        {/* <a
                            href='#'
                            className='text-primary hover:text-primary/90'
                        >
                            <Logo />
                        </a> */}
                        {/* Navigation menu */}
                        <NavigationMenu className='max-md:hidden'>
                            <NavigationMenuList className='gap-2'>
                                <NavigationMenuItem>
                                    <Button
                                        isLoading={isLoading}
                                        onClick={sync}
                                        size={'sm'}
                                    >
                                        Sync With GitHub
                                    </Button>
                                </NavigationMenuItem>

                                {navigationLinks.map((link, index) => (
                                    <NavigationMenuItem key={index}>
                                        <NavigationMenuLink
                                            // active={link.active}
                                            href={link.href}
                                            className='text-muted-foreground hover:text-primary py-1.5 font-medium'
                                        >
                                            {link.label}
                                        </NavigationMenuLink>
                                    </NavigationMenuItem>
                                ))}
                            </NavigationMenuList>
                        </NavigationMenu>
                    </div>
                </div>
                {/* Right side */}
                <div className='flex items-center gap-2'>
                    <Button
                        asChild
                        variant='ghost'
                        size='sm'
                        className='text-sm'
                    >
                        <a href='#'>Sign In</a>
                    </Button>
                    <Button asChild size='sm' className='text-sm'>
                        <a href='#'>Get Started</a>
                    </Button>
                </div>
            </div>
        </header>
    )
}
