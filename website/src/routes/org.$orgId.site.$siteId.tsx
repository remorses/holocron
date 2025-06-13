import { href, redirect, useLoaderData } from 'react-router'
import { colord, extend } from 'colord'
import type { Route } from './+types/org.$orgId.site.$siteId'
import { getSession } from '../lib/better-auth'
import { prisma } from 'db'
import { cn } from '../lib/utils'
import { BrowserWindow } from '../components/browser-window'
import { Button } from '../components/ui/button'
import { SaveIcon } from 'lucide-react'
import { useState, useRef, useEffect, CSSProperties } from 'react'
import { UploadButton } from '../components/upload-button'
import { useThrowingFn } from '../lib/hooks'
import { ColorPicker } from '../components/color-picker'
import Chat from '../components/chat'
import { StateProvider } from '../components/state-provider'
import NavBar from '../components/navbar'
import { url } from 'inspector'
import { AppSidebar } from '../components/app-sidebar'
import { SidebarProvider, SidebarInset } from '../components/ui/sidebar'

export async function loader({
    request,
    params: { orgId, siteId },
}: Route.LoaderArgs) {
    const { userId, redirectTo } = await getSession({ request })
    if (redirectTo) {
        throw redirect(redirectTo)
    }
    const site = await prisma.site.findUnique({
        where: {
            siteId: siteId,
        },
        include: {
            org: true,
            domains: true,
            tabs: true,
            customization: true,
        },
    })

    if (!site) {
        throw new Error('Site not found')
    }

    // Check if user has access to this site through org membership
    const orgUser = await prisma.orgsUsers.findUnique({
        where: {
            userId_orgId: {
                userId: userId!,
                orgId: orgId,
            },
        },
    })

    if (!orgUser) {
        throw redirect('/dashboard')
    }
    const host = site.domains.find(
        (x) => x.domainType === 'internalDomain',
    )?.host

    const url = `https://${host}`

    return { site, url, host }
}

export default function Page({
    loaderData: { site, host, url },
    params: { siteId, orgId },
}: Route.ComponentProps) {
    return (
        <StateProvider value={{ messages: [] }}>
            <SidebarProvider
                className=''
                style={
                    {
                        '--sidebar-width': '480px',
                        '--sidebar-width-mobile': '20rem',
                    } as any
                }
            >
                <AppSidebar />
                <SidebarInset>
                    <div className='flex grow h-full flex-col gap-4 p-2 pt-0'>
                        <Content />
                    </div>
                </SidebarInset>
            </SidebarProvider>
        </StateProvider>
    )
}

function Content() {
    const { site, host, url } = useLoaderData<typeof loader>()
    const [logoUrl, setLogoUrl] = useState(site.customization?.logoUrl)
    const iframeRef = useRef<HTMLIFrameElement>(null)

    const [color, setColor] = useState(site.customization?.color || '')
    useEffect(() => {
        updatePageProps({ logoUrl, color: color || undefined }, iframeRef)
    }, [color, logoUrl])
    return (
        <div className='flex flex-col h-full gap-4 px-4 pb-4'>
            <NavBar />

            <div className='flex grow flex-col'>
                <BrowserWindow
                    url={url}
                    onRefresh={() => {
                        const iframe = iframeRef.current
                        if (iframe) {
                            iframe.src += ''
                        }
                    }}
                    className={cn(
                        'text-sm shrink-0 shadow rounded-xl justify-stretch',
                        'items-stretch h-full flex-col flex-1 border',
                        'bg-white lg:flex dark:bg-gray-800',
                    )}
                >
                    <iframe
                        ref={iframeRef}
                        style={scaleDownElement(0.8)}
                        className={cn(' inset-0 bg-transparent', 'absolute')}
                        frameBorder={0}
                        allowTransparency
                        name='previewProps' // tell iframe preview props is enabled
                        // height='120%'

                        title='website preview'
                        // onLoad={() => setLoaded(true)}
                        src={url}
                    ></iframe>
                    {/* {!loaded && (
                      <div className='flex justify-center items-center inset-0 absolute'>
                          <Spinner className='text-gray-600 text-5xl'></Spinner>
                      </div>
                  )} */}
                </BrowserWindow>
            </div>
        </div>
    )
}

function Block({ children, className = '', ...props }) {
    return (
        <div
            className={cn('rounded-lg border bg-card p-6 shadow-sm', className)}
            {...props}
        >
            {children}
        </div>
    )
}

type SiteData = any

function updatePageProps(newPageProps: Partial<SiteData>, iframeRef) {
    if (!iframeRef?.current || !newPageProps) {
        console.log('updatePageProps: no iframeElement or newPageProps')
        return
    }
    iframeRef?.current?.contentWindow.postMessage(
        { newPageProps },
        { targetOrigin: '*' },
    )
}

function scaleDownElement(iframeScale) {
    return {
        transform: `scale(${iframeScale})`,
        transformOrigin: 'top left',
        width: `${Number(100 / iframeScale).toFixed(1)}%`,
        height: `${Number(100 / iframeScale).toFixed(1)}%`,
    }
}
