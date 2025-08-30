'use client'

import Editor, { loader, OnMount, useMonaco } from '@monaco-editor/react'
import { useEffect, useRef, useState, useCallback } from 'react'
import { useTheme } from 'next-themes'
import { colord } from 'colord'

import * as monaco from 'monaco-editor'
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker'
import cssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker'
import htmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker'
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker'
import { cn } from '../lib/cn'
import { XIcon } from 'lucide-react'
import { Button } from './ui/button'
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from './ui/tooltip'
import { useDocsState } from '../lib/docs-state'

// Configure Monaco workers for Vite
self.MonacoEnvironment = {
    getWorker(_, label) {
        if (label === 'json') return new jsonWorker()
        if (label === 'css' || label === 'scss' || label === 'less')
            return new cssWorker()
        if (label === 'html' || label === 'handlebars' || label === 'razor')
            return new htmlWorker()
        if (label === 'typescript' || label === 'javascript')
            return new tsWorker()
        return new editorWorker()
    },
}

// Configure Monaco loader for Vite
loader.config({ monaco })

interface MonacoMarkdownEditorProps {
    value: string
    onChange: (value: string | undefined) => void
    className?: string
}

export function MonacoMarkdownEditor({
    value,
    onChange,
    className,
}: MonacoMarkdownEditorProps) {
    const { resolvedTheme: theme, forcedTheme } = useTheme()
    const resolvedTheme = forcedTheme || theme
    const monaco = useMonaco()
    const editorRef = useRef<Parameters<OnMount>[0] | null>(null)
    const [ready, setReady] = useState(false)

    const defineCustomTheme = useCallback(() => {
        if (!monaco) return

        // Get the computed CSS variable value
        const computedStyle = getComputedStyle(document.body)
        const bgColorRaw = computedStyle
            .getPropertyValue('--color-fd-background')
            .trim()

        if (!bgColorRaw) {
            console.warn(
                'Monaco editor: Could not get --color-fd-background CSS variable, falling back to default colors',
            )
        }

        // Convert to hex format and apply 80% alpha since Monaco doesn't support HSL/CSS variables
        let bgColor: string
        try {
            bgColor = bgColorRaw
                ? colord(bgColorRaw).toHex()
                : resolvedTheme === 'dark'
                  ? '#1e1e1e'
                  : '#ffffff'
        } catch (error) {
            console.error(
                'Monaco editor: Failed to parse background color:',
                bgColorRaw,
                error,
            )
            // Fallback if color parsing fails
            bgColor = resolvedTheme === 'dark' ? '#1e1e1e' : '#ffffff'
        }

        // Define custom theme with the CSS variable background
        monaco.editor.defineTheme('docs-theme', {
            base: resolvedTheme === 'dark' ? 'vs-dark' : 'vs',
            inherit: true,
            rules: [],
            colors: {
                'editor.background': '#00000000',
                focusBorder: '#00000000',
            },
        })

        // Apply the theme
        monaco.editor.setTheme('docs-theme')
    }, [monaco, resolvedTheme])

    const handleEditorMount: OnMount = (editor) => {
        editorRef.current = editor

        // Set up custom theme with CSS variable background
        defineCustomTheme()

        // Mark editor as ready after mount and theme setup
        setReady(true)
    }

    // Update theme when resolvedTheme changes
    useEffect(() => {
        if (monaco && editorRef.current) {
            defineCustomTheme()
        }
    }, [resolvedTheme, monaco, defineCustomTheme])

    // Monaco initialization is handled by useMonaco hook
    // The default markdown language service is actually quite good
    // Most custom configuration is redundant since Monaco already has built-in markdown support
    // The built-in markdown service already handles:
    // - Syntax highlighting for markdown
    // - Auto-closing pairs for quotes, brackets, etc.
    // - Word pattern recognition
    // - HTML comment support
    // - Code block detection

    return (
        <div
            className='not-prose -mx-2 relative'
            style={{ height: 'calc(100vh - var(--fd-nav-height))' }}
        >
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            variant='ghost'
                            size='sm'
                            className='absolute top-2 right-6 z-10 size-8 p-0'
                            onClick={() => {
                                useDocsState.setState((state) => ({
                                    ...state,
                                    previewMode: 'preview',
                                }))
                            }}
                        >
                            <XIcon className='size-4' />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>Close editor</p>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
            <Editor
                // key={resolvedTheme}
                height='100%'
                defaultLanguage='markdown'
                className='grow-0 not-prose'
                language='markdown'
                value={value}
                onChange={onChange}
                onMount={handleEditorMount}
                theme='docs-theme'
                // loading={null}
                wrapperProps={{
                    className: cn(
                        'h-full transition-opacity duration-300',
                        !ready && 'opacity-0',
                    ),
                }}
                options={{
                    minimap: { enabled: false },
                    scrollbar: {
                        vertical: 'auto',
                        horizontal: 'auto',
                        handleMouseWheel: true,
                        alwaysConsumeMouseWheel: false,
                    },
                    overviewRulerLanes: 0,
                    hideCursorInOverviewRuler: true,
                    overviewRulerBorder: false,

                    fontSize: 14,
                    lineNumbers: 'on',
                    wordWrap: 'on',
                    scrollBeyondLastLine: false,
                    automaticLayout: true,
                    tabSize: 2,
                    insertSpaces: true,
                    formatOnPaste: true,
                    formatOnType: true,
                    renderWhitespace: 'selection',
                    folding: true,
                    foldingStrategy: 'indentation',
                    lineDecorationsWidth: 5,
                    lineNumbersMinChars: 3,
                    padding: {
                        top: 16,
                        bottom: 16,
                    },
                }}
            />
        </div>
    )
}
