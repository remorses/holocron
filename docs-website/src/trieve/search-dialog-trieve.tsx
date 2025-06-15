'use client'

import { type ReactNode, useState } from 'react'
import {
    SearchDialog,
    SearchDialogClose,
    SearchDialogContent,
    SearchDialogFooter,
    SearchDialogHeader,
    SearchDialogIcon,
    SearchDialogInput,
    SearchDialogList,
    SearchDialogOverlay,
    SharedProps,
    TagsList,
} from 'fumadocs-ui/components/dialog/search'
import { TrieveSDK } from 'trieve-ts-sdk'

import React from 'react'
import { useOnChange } from 'fumadocs-core/utils/use-on-change'
import { RootProvider } from 'fumadocs-ui/provider/base'
import { TagItem } from 'fumadocs-ui/contexts/search'
import { useI18n } from 'fumadocs-ui/contexts/i18n'
import { useTrieveSearch } from './trieve-client'

export interface TrieveSearchDialogProps extends SharedProps {
    trieveClient: TrieveSDK
    footer?: ReactNode

    defaultTag?: string
    tags?: TagItem[]

    /**
     * Allow to clear tag filters
     *
     * @defaultValue false
     */
    allowClear?: boolean
}

export function TrieveSearchDialog({
    trieveClient,
    tags,
    defaultTag,

    allowClear = false,
    ...props
}: TrieveSearchDialogProps): React.ReactElement {
    const [tag, setTag] = useState(defaultTag)
    const { locale } = useI18n() // (optional) for i18n

    const { search, setSearch, query } = useTrieveSearch(
        trieveClient,
        locale,
        tag,
    )

    useOnChange(defaultTag, (v) => {
        setTag(v)
    })

    return (
        <SearchDialog
            search={search}
            onSearchChange={setSearch}
            isLoading={query.isLoading}
            {...props}
        >
            <SearchDialogOverlay />
            <SearchDialogContent>
                <SearchDialogHeader>
                    <SearchDialogIcon />
                    <SearchDialogInput />
                    <SearchDialogClose />
                </SearchDialogHeader>

                <SearchDialogList
                    items={query.data !== 'empty' ? query.data : null}
                />
                <SearchDialogFooter>
                    <div className='ms-auto text-xs text-fd-muted-foreground'>
                        Search powered by{' '}
                        <b>
                            <a
                                href='https://fumabase.com'
                                target='_blank'
                                rel='noopener noreferrer'
                                className='text-fd-muted-foreground'
                            >
                                Fumabase
                            </a>
                        </b>
                    </div>
                </SearchDialogFooter>
            </SearchDialogContent>
        </SearchDialog>
    )
}
