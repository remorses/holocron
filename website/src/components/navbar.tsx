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
    return (
        <header className='border-b px-4 md:px-6'>
            <div className='flex h-16 items-center justify-between gap-4'>
                {/* Left side */}
                <div className='flex items-center gap-2'>
                    {/* Mobile menu trigger */}
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button
                                className='group size-8 md:hidden'
                                variant='ghost'
                                size='icon'
                            >
                                <svg
                                    className='pointer-events-none'
                                    width={16}
                                    height={16}
                                    viewBox='0 0 24 24'
                                    fill='none'
                                    stroke='currentColor'
                                    strokeWidth='2'
                                    strokeLinecap='round'
                                    strokeLinejoin='round'
                                    xmlns='http://www.w3.org/2000/svg'
                                >
                                    <path
                                        d='M4 12L20 12'
                                        className='origin-center -translate-y-[7px] transition-all duration-300 ease-[cubic-bezier(.5,.85,.25,1.1)] group-aria-expanded:translate-x-0 group-aria-expanded:translate-y-0 group-aria-expanded:rotate-[315deg]'
                                    />
                                    <path
                                        d='M4 12H20'
                                        className='origin-center transition-all duration-300 ease-[cubic-bezier(.5,.85,.25,1.8)] group-aria-expanded:rotate-45'
                                    />
                                    <path
                                        d='M4 12H20'
                                        className='origin-center translate-y-[7px] transition-all duration-300 ease-[cubic-bezier(.5,.85,.25,1.1)] group-aria-expanded:translate-y-0 group-aria-expanded:rotate-[135deg]'
                                    />
                                </svg>
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent
                            align='start'
                            className='w-36 p-1 md:hidden'
                        >
                            <NavigationMenu className='max-w-none *:w-full'>
                                <NavigationMenuList className='flex-col items-start gap-0 md:gap-2'>
                                    {navigationLinks.map((link, index) => (
                                        <NavigationMenuItem
                                            key={index}
                                            className='w-full'
                                        >
                                            <NavigationMenuLink
                                                href={link.href}
                                                className='py-1.5'
                                                active={link.active}
                                            >
                                                {link.label}
                                            </NavigationMenuLink>
                                        </NavigationMenuItem>
                                    ))}
                                </NavigationMenuList>
                            </NavigationMenu>
                        </PopoverContent>
                    </Popover>
                    {/* Main nav */}
                    <div className='flex items-center gap-6'>
                        <a
                            href='#'
                            className='text-primary hover:text-primary/90'
                        >
                            <Logo />
                        </a>
                        {/* Navigation menu */}
                        <NavigationMenu className='max-md:hidden'>
                            <NavigationMenuList className='gap-2'>
                                {navigationLinks.map((link, index) => (
                                    <NavigationMenuItem key={index}>
                                        <NavigationMenuLink
                                            active={link.active}
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
