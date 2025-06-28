import clsx from 'clsx'
import * as FilesComponents from 'fumadocs-ui/components/files';
import * as TabsComponents from 'fumadocs-ui/components/tabs';
import { Accordion, Accordions } from 'fumadocs-ui/components/accordion';
import { Callout } from 'fumadocs-ui/components/callout';
import { Card, Cards } from 'fumadocs-ui/components/card';
import { Steps, Step } from 'fumadocs-ui/components/steps';

import { Math } from './math'
import { CSSProperties } from 'react'
import fumadocsComponents from 'fumadocs-ui/mdx'

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

// Mintlify-style callout components using fumadocs Callout
function Note({ children }: { children: React.ReactNode }) {
    return <Callout type="info">{children}</Callout>
}

function Warning({ children }: { children: React.ReactNode }) {
    return <Callout type="warn">{children}</Callout>
}

function Info({ children }: { children: React.ReactNode }) {
    return <Callout type="info">{children}</Callout>
}

function Tip({ children }: { children: React.ReactNode }) {
    return <Callout>{children}</Callout>
}

function Check({ children }: { children: React.ReactNode }) {
    return <Callout type="success">{children}</Callout>
}

// API documentation components
function ParamField({
    body,
    query,
    path,
    header,
    required,
    type,
    children
}: {
    body?: string;
    query?: string;
    path?: string;
    header?: string;
    required?: boolean;
    type?: string;
    children?: React.ReactNode;
}) {
    const paramName = body || query || path || header || 'parameter'
    const paramType = type || 'string'
    const location = body ? 'body' : query ? 'query' : path ? 'path' : header ? 'header' : 'parameter'

    return (
        <div className="border border-border rounded-lg p-4 mb-4">
            <div className="flex items-center gap-2 mb-2">
                <code className="text-sm font-mono bg-muted px-2 py-1 rounded">
                    {paramName}
                </code>
                <span className="text-xs text-muted-foreground">{location}</span>
                {required && (
                    <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded">
                        required
                    </span>
                )}
                <span className="text-xs text-muted-foreground">
                    {paramType}
                </span>
            </div>
            {children && <div className="text-sm text-muted-foreground">{children}</div>}
        </div>
    )
}

function ResponseField({
    name,
    type,
    required,
    children
}: {
    name?: string;
    type?: string;
    required?: boolean;
    children?: React.ReactNode;
}) {
    const fieldName = name || 'field'
    const fieldType = type || 'string'

    return (
        <div className="border-l-4 border-green-200 pl-4 mb-3">
            <div className="flex items-center gap-2 mb-1">
                <code className="text-sm font-mono">
                    {fieldName}
                </code>
                {required && (
                    <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded">
                        required
                    </span>
                )}
                <span className="text-xs text-muted-foreground">
                    {fieldType}
                </span>
            </div>
            {children && <div className="text-sm text-muted-foreground">{children}</div>}
        </div>
    )
}

export const mdxComponents = {
    ...fumadocsComponents,
    summary: 'summary',
    details: 'details',
    Math,
    // TodoItem,
    ColumnList,
    Column,
    ...TabsComponents,
    ...FilesComponents,
    Accordion,
    Accordions,
    // Mintlify-style callout components
    Note,
    Warning,
    Info,
    Tip,
    Check,
    // Mintlify-style other components
    Card,
    Cards,
    Steps,
    Step,
    // API documentation components
    // ParamField, // TODO, make sure param fields look good
    // ResponseField,
    // Embed,
    // File,
    // Audio,
    // NotionIcon,
    // Video,
}
