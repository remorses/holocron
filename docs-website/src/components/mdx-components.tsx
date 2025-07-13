import clsx from 'clsx'
import * as FilesComponents from 'fumadocs-ui/components/files'
import * as TabsComponents from 'fumadocs-ui/components/tabs'
import { Accordion, Accordions } from 'fumadocs-ui/components/accordion'
import { Callout } from 'fumadocs-ui/components/callout'
import * as CardsComponents from 'fumadocs-ui/components/card'
import { Steps, Step } from 'fumadocs-ui/components/steps'

import { Latex } from './math'
import { CSSProperties } from 'react'
import fumadocsComponents from 'fumadocs-ui/mdx'
import { DynamicIcon } from '../lib/icon'
import React from 'react'

const Mermaid = React.lazy(() => import('./mermaid'))

function TodoItem({
    checked,
    onChange,
    children,
    className,
    style,
}: {
    checked?: boolean
    onChange?: (checked: boolean) => void
    children?: React.ReactNode
    className?: string
    style?: CSSProperties
}) {
    return (
        <div
            className={clsx('flex items-center my-2', className)}
            style={style}
        >
            <input
                type='checkbox'
                checked={checked}
                // onChange={(e) => onChange?.(e.target.checked)}
                className='h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 mr-2'
            />
            <div className={clsx(checked && 'line-through text-gray-500')}>
                {children}
            </div>
        </div>
    )
}

function Columns({
    children,
    cols = 2,
}: {
    children?: React.ReactNode
    cols?: number
}) {
    return (
        <div
            className={`grid gap-4 my-4`}
            style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
        >
            {children}
        </div>
    )
}

function Column({ children }: { children?: React.ReactNode }) {
    return <div className='flex flex-col gap-4 p-2 flex-1'>{children}</div>
}

function Embed({ src, children }: { src: string; children?: string }) {
    const caption = children || 'Embedded Content'
    return (
        <div className='my-4 p-4 border border-gray-200 rounded-md bg-gray-50'>
            <iframe
                src={src}
                title={caption}
                className='w-full h-[400px] border-none'
                allowFullScreen
            />
            <div className='mt-2 text-sm text-gray-500 text-center'>
                {caption}
            </div>
        </div>
    )
}

function File({
    url,
    name,
    children,
}: {
    url: string
    name?: string
    children?: string
}) {
    const displayText = children || name || 'Download File'
    return (
        <div className='my-4 p-4 border border-gray-200 rounded-md bg-gray-50'>
            <a
                href={url}
                download={name || true}
                className='block no-underline text-blue-500 font-medium'
            >
                {displayText}
            </a>
            {name && children && name !== children && (
                <div className='mt-2 text-sm text-gray-500'>{name}</div>
            )}
        </div>
    )
}

function Audio({ src, children }: { src: string; children?: string }) {
    return (
        <div className='my-4 p-4 border border-gray-200 rounded-md bg-gray-50'>
            <audio controls className='w-full'>
                <source src={src} />
                Your browser does not support the audio element.
            </audio>
            {children && (
                <div className='mt-2 text-sm text-gray-500 text-center'>
                    {children}
                </div>
            )}
        </div>
    )
}

function NotionIcon({ url }: { url: string }) {
    if (!url) {
        return null
    }

    return <img src={url} className='w-4 h-4' alt='' />
}

function Video({ src, children }: { src: string; children?: string }) {
    return (
        <div className='relative pb-[56.25%] h-0 overflow-hidden max-w-full my-4'>
            <iframe
                src={src}
                title={children || 'Video'}
                allow='accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture'
                allowFullScreen
                className='absolute top-0 left-0 w-full h-full border-0'
            />
            {children && (
                <div className='text-center text-sm text-gray-500 mt-2'>
                    {children}
                </div>
            )}
        </div>
    )
}

// Mintlify-style callout components using fumadocs Callout
function Note({ children }: { children: React.ReactNode }) {
    return <Callout type='info'>{children}</Callout>
}

function Warning({ children }: { children: React.ReactNode }) {
    return <Callout type='warn'>{children}</Callout>
}

function Info({ children }: { children: React.ReactNode }) {
    return <Callout type='info'>{children}</Callout>
}

function Tip({ children }: { children: React.ReactNode }) {
    return <Callout>{children}</Callout>
}

function Check({ children }: { children: React.ReactNode }) {
    return <Callout type='success'>{children}</Callout>
}

// Mintlify-style Card component with correct props
function MintlifyCard({
    title,
    icon,
    iconType,
    color,
    href,
    horizontal,
    img,
    cta,
    arrow,
    children,
}: {
    title: string
    icon?: string
    iconType?:
        | 'regular'
        | 'solid'
        | 'light'
        | 'thin'
        | 'sharp-solid'
        | 'duotone'
        | 'brands'
    color?: string
    href?: string
    horizontal?: boolean
    img?: string
    cta?: string
    arrow?: boolean
    children?: React.ReactNode
}) {
    // Use fumadocs Card as base but with Mintlify prop mapping
    return (
        <CardsComponents.Card
            title={title}
            children={children}
            href={href}
            icon={typeof icon === 'string' ? <DynamicIcon icon={icon} /> : icon}
            {...(img && { image: img })}
        />
    )
}

// API documentation components
function ParamField({
    path,
    body,
    query,
    header,
    type,
    required,
    deprecated,
    default: defaultValue,
    initialValue,
    placeholder,
    children,
}: {
    path?: string
    body?: string
    query?: string
    header?: string
    type?: string
    required?: boolean
    deprecated?: boolean
    default?: string
    initialValue?: any
    placeholder?: string
    children?: React.ReactNode
}) {
    const paramName = path || body || query || header || 'parameter'
    const paramType = type || 'string'
    const location = path
        ? 'path'
        : body
          ? 'body'
          : query
            ? 'query'
            : header
              ? 'header'
              : 'parameter'

    return (
        <div className='border border-border rounded-lg p-4 mb-4'>
            <div className='flex items-center gap-2 mb-2'>
                <code className='text-sm font-mono bg-muted px-2 py-1 rounded'>
                    {paramName}
                </code>
                <span className='text-xs text-muted-foreground'>
                    {location}
                </span>
                {required && (
                    <span className='text-xs bg-red-100 text-red-800 px-2 py-1 rounded'>
                        required
                    </span>
                )}
                {deprecated && (
                    <span className='text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded'>
                        deprecated
                    </span>
                )}
                <span className='text-xs text-muted-foreground'>
                    {paramType}
                </span>
                {defaultValue && (
                    <span className='text-xs text-muted-foreground'>
                        default: {defaultValue}
                    </span>
                )}
            </div>
            {children && (
                <div className='text-sm text-muted-foreground'>{children}</div>
            )}
        </div>
    )
}

function ResponseField({
    name,
    type,
    required,
    deprecated,
    default: defaultValue,
    pre,
    post,
    children,
}: {
    name: string
    type: string
    required?: boolean
    deprecated?: boolean
    default?: string
    pre?: string[]
    post?: string[]
    children?: React.ReactNode
}) {
    return (
        <div className='border-l-4 border-green-200 pl-4 mb-3'>
            <div className='flex items-center gap-2 mb-1'>
                {pre &&
                    pre.map((label, i) => (
                        <span
                            key={i}
                            className='text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded'
                        >
                            {label}
                        </span>
                    ))}
                <code className='text-sm font-mono'>{name}</code>
                {required && (
                    <span className='text-xs bg-red-100 text-red-800 px-2 py-1 rounded'>
                        required
                    </span>
                )}
                {deprecated && (
                    <span className='text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded'>
                        deprecated
                    </span>
                )}
                <span className='text-xs text-muted-foreground'>{type}</span>
                {defaultValue && (
                    <span className='text-xs text-muted-foreground'>
                        default: {defaultValue}
                    </span>
                )}
                {post &&
                    post.map((label, i) => (
                        <span
                            key={i}
                            className='text-xs bg-gray-100 text-gray-800 px-2 py-1 rounded'
                        >
                            {label}
                        </span>
                    ))}
            </div>
            {children && (
                <div className='text-sm text-muted-foreground'>{children}</div>
            )}
        </div>
    )
}

function Expandable({
    title,
    children,
    defaultOpen = false,
}: {
    title: string
    children: React.ReactNode
    defaultOpen?: boolean
}) {
    const [isOpen, setIsOpen] = React.useState(defaultOpen)

    return (
        <div className='border border-border rounded-lg my-4'>
            <button
                onClick={() => {
                    setIsOpen(!isOpen)
                }}
                className='w-full flex items-center justify-between p-4 text-left hover:bg-muted/50 transition-colors'
            >
                <span className='font-medium'>{title}</span>
                <svg
                    className={clsx(
                        'size-4 transition-transform',
                        isOpen && 'rotate-180',
                    )}
                    fill='none'
                    viewBox='0 0 24 24'
                    stroke='currentColor'
                >
                    <path
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        strokeWidth={2}
                        d='M19 9l-7 7-7-7'
                    />
                </svg>
            </button>
            {isOpen && (
                <div className='px-4 pb-4 border-t border-border'>
                    {children}
                </div>
            )}
        </div>
    )
}

function Frame({
    caption,
    children,
    style,
}: {
    caption?: React.ReactNode
    children: React.ReactNode
    style?: React.CSSProperties
}) {
    return (
        <div
            data-name='frame'
            className={clsx(
                'frame p-2 not-prose relative bg-gray-50/50 rounded-2xl overflow-hidden dark:bg-gray-800/25',
            )}
            style={style}
        >
            <div className='relative rounded-xl overflow-hidden flex justify-center'>
                {children}
            </div>
            {caption && (
                <div className='relative rounded-2xl flex justify-center mt-3 pt-0 px-8 pb-2 text-sm text-gray-700 dark:text-gray-400'>
                    {typeof caption === 'string' ? <p>{caption}</p> : caption}
                </div>
            )}
            <div className='absolute inset-0 pointer-events-none border border-black/5 rounded-2xl dark:border-white/5'></div>
        </div>
    )
}

function Tab({
    children,
    title,
    ...props
}: {
    children: React.ReactNode
    title?: string
}) {
    return (
        <TabsComponents.Tab value={title} {...props}>
            {children}
        </TabsComponents.Tab>
    )
}

Tab.displayName = 'Tab'

function Tabs(props: React.ComponentProps<typeof TabsComponents.Tabs>) {
    // Helper to check if a node is a Tab
    const isTab = (el: any) => {
        if (!el || typeof el !== 'object' || !el.type) return false
        // Accept both imported Tab component or a TabsComponents.Tab function/component
        return (
            el.type === Tab ||
            el.type === TabsComponents.Tab ||
            (typeof el.type === 'function' && el.type.displayName === 'Tab')
        )
    }

    // Normalize children: wrap non-Tab children in a Tab using title/value if possible
    function normalizeChildren(children: React.ReactNode): React.ReactNode[] {
        const arr = React.Children.toArray(children)
        return arr.map((child, idx) => {
            if (isTab(child)) {
                return child
            }
            // Try to use .props.title or .props.value if available
            const asElement = child as any
            const tabTitle =
                (asElement?.props?.title as string) ??
                (asElement?.props?.value as string) ??
                `Tab ${idx + 1}`

            return (
                <Tab title={tabTitle} key={asElement?.key ?? idx}>
                    {child}
                </Tab>
            )
        })
    }

    // Extract tab titles from children (whether already Tab or wrapped)
    function extractTitles(children: React.ReactNode): string[] {
        const arr = React.Children.toArray(children)
        const titles: string[] = []
        arr.forEach((child, idx) => {
            const asElement = child as any
            if (
                asElement &&
                asElement.props &&
                (typeof asElement.props.title === 'string' ||
                    typeof asElement.props.value === 'string')
            ) {
                titles.push(
                    (asElement.props.title as string) ??
                        (asElement.props.value as string) ??
                        `Tab ${idx + 1}`,
                )
            } else {
                titles.push(`Tab ${idx + 1}`)
            }
        })
        return titles
    }

    if (props.items) {
        return <TabsComponents.Tabs {...props} />
    }

    const normalizedChildren = normalizeChildren(props.children)
    const items = extractTitles(normalizedChildren)

    return (
        <TabsComponents.Tabs {...props} items={items}>
            {normalizedChildren}
        </TabsComponents.Tabs>
    )
}

Tabs.displayName = 'Tabs'

export const mdxComponents = {
    CodeBlockTab: fumadocsComponents.CodeBlockTab,
    CodeBlockTabs: fumadocsComponents.CodeBlockTabs,
    // CodeBlockTabsList: fumadocsComponents.CodeBlockTabsList,
    // CodeBlockTabsTrigger: fumadocsComponents.CodeBlockTabsTrigger,
    pre: fumadocsComponents.pre,
    // Card: fumadocsComponents.Card,
    // Cards: fumadocsComponents.Cards,
    a: fumadocsComponents.a,
    img: fumadocsComponents.img,
    h1: fumadocsComponents.h1,
    h2: fumadocsComponents.h2,
    h3: fumadocsComponents.h3,
    h4: fumadocsComponents.h4,
    h5: fumadocsComponents.h5,
    h6: fumadocsComponents.h6,
    table: fumadocsComponents.table,
    Callout: fumadocsComponents.Callout,
    summary: 'summary',
    details: 'details',
    Latex: Latex,
    // TodoItem,
    Columns,
    Column,
    Tabs: Tabs,
    Tab: Tab,
    Accordion,
    Accordions,
    AccordionGroup: Accordions,
    // Mintlify-style callout components
    Note,
    Warning,
    Info,
    Tip,
    Check,
    // Mintlify-style other components
    Card: MintlifyCard,
    Cards: CardsComponents.Cards,
    CardGroup: CardsComponents.Cards,
    Steps,
    Step,
    CodeGroup: Tabs,
    Frame,
    Expandable,
    Mermaid,
    // API documentation components
    // ParamField,
    // ResponseField,
    // Embed,
    // File,
    // Audio,
    // NotionIcon,
    // Video,
}
