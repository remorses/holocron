'use client'

import Editor, { loader } from '@monaco-editor/react'
import { useEffect } from 'react'
import { useTheme } from 'next-themes'

import * as monaco from 'monaco-editor'
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker'
import cssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker'
import htmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker'
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker'

// Configure Monaco workers for Vite
self.MonacoEnvironment = {
    getWorker(_, label) {
        if (label === 'json') return new jsonWorker()
        if (label === 'css' || label === 'scss' || label === 'less') return new cssWorker()
        if (label === 'html' || label === 'handlebars' || label === 'razor') return new htmlWorker()
        if (label === 'typescript' || label === 'javascript') return new tsWorker()
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
    const { resolvedTheme } = useTheme()

    useEffect(() => {
        // Initialize Monaco editor - the default markdown language service is actually quite good
        // Most of this configuration is redundant since Monaco already has built-in markdown support
        loader.init().then((monaco) => {
            // We could customize markdown language configuration here if needed, but the defaults work well
            // The built-in markdown service already handles:
            // - Syntax highlighting for markdown
            // - Auto-closing pairs for quotes, brackets, etc.
            // - Word pattern recognition
            // - HTML comment support
            // - Code block detection
            
            // Only add custom config if we need specific behavior that differs from defaults
            // For now, using Monaco's built-in markdown support is sufficient
        })
    }, [])

    return (
        <div className={className}>
            <Editor
                height="100%"
                defaultLanguage="markdown"
                language="markdown"
                value={value}
                onChange={onChange}
                theme={resolvedTheme === 'dark' ? 'vs-dark' : 'light'}
                options={{
                    minimap: { enabled: false },
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