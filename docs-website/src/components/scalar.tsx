'use client'
import { ApiReferenceReact } from '@scalar/api-reference-react'
import '@scalar/api-reference-react/style.css'
import { useTheme } from 'next-themes'
import * as React from 'react'
import { Portal } from 'radix-ui'
import { createPortal } from 'react-dom'

export const ScalarOpenApi = ({ url }: { url: string }) => {
    const { resolvedTheme, theme, forcedTheme } = useTheme()
    // const theme = forcedTheme || resolvedTheme
    return (
        <div className='[&>div]:relative pt-[100px] relative left-0 right-0 top-0 bottom-0 [--scalar-custom-header-height:var(--fd-nav-height)]  '>
            <style>{`
              #nd-sidebar { display: none !important; }
              * { --fd-sidebar-width: 0px !important; }
              `}</style>

            <ApiReferenceReact
                key={resolvedTheme}
                configuration={{
                    url,
                    searchHotKey: 'j',
                    // darkMode: false,
                    hideSearch: true,
                    hideDarkModeToggle: true,
                }}
            />
        </div>
    )
}

const Layout = ({ children }: { children?: React.ReactNode }) => {
    return <div className={'scalar-container'}>{children}</div>
}
