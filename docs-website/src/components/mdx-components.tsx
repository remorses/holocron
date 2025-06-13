import clsx from 'clsx'
import { Math } from './math'
import { CSSProperties } from 'react'
import defaultMdxComponents from 'fumadocs-ui/mdx'

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

function ColumnList({ children }: { children?: React.ReactNode }) {
    return (
        <div className='flex flex-row flex-wrap gap-4 my-4'>{children}</div>
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

export const mdxComponents = {
    ...defaultMdxComponents,
    summary: 'summary',
    details: 'details',
    Math,
    TodoItem,
    ColumnList,
    Column,
    Embed,
    File,
    Audio,
    NotionIcon,
    Video,
}
