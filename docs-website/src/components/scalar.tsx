'use client'
import { ApiReferenceReact } from '@scalar/api-reference-react'
import '@scalar/api-reference-react/style.css'

import * as React from 'react'
import { Portal } from 'radix-ui'
import { createPortal } from 'react-dom'

export const ScalarOpenApi = ({ url }: { url: string }) => {
    return (
        <div className='[&>div]:relative border  pt-[100px] relative left-0 right-0 top-0 bottom-0 [--scalar-custom-header-height:var(--fd-nav-height)]  '>
            <style>{`
              #nd-sidebar { display: none !important; }
              * { --fd-sidebar-width: 0px !important; }
              `}</style>

            <ApiReferenceReact
                configuration={{
                    url: 'https://cdn.jsdelivr.net/npm/@scalar/galaxy/dist/latest.yaml',
                    searchHotKey: 'j',

                    hideDarkModeToggle: true,
                }}
            />
        </div>
    )
    if (typeof window == 'undefined') return null
    return createPortal(
        <div className='[&>div]:relative pt-[100px] relative left-0 right-0 top-0 bottom-0 [--scalar-custom-header-height:var(--fd-nav-height)] w-full '>
            <style>{`#nd-sidebar { display: none !important; }`}</style>
            <ApiReferenceReact
                configuration={{
                    url: 'https://cdn.jsdelivr.net/npm/@scalar/galaxy/dist/latest.yaml',
                    searchHotKey: 'j',

                    hideDarkModeToggle: true,
                }}
            />
        </div>,
        typeof window !== 'undefined' ? document.body : null,
    )
}

const Layout = ({ children }: { children?: React.ReactNode }) => {
    return <div className={'scalar-container'}>{children}</div>
}
