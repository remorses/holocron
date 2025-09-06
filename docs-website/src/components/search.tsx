'use client'

import {
  SearchDialog,
  SearchDialogClose,
  SearchDialogContent,
  SearchDialogFooter,
  SearchDialogHeader,
  SearchDialogIcon,
  SearchDialogInput,
  SearchDialogList,
  SearchDialogListItem,
  SearchDialogOverlay,
  type SharedProps,
} from 'fumadocs-ui/components/dialog/search'
import { useDocsSearch } from 'fumadocs-core/search/client'
import { useMemo, useState } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from 'fumadocs-ui/components/ui/popover'
import { ChevronDown } from 'lucide-react'
import { buttonVariants } from 'fumadocs-ui/components/ui/button'
import { cn } from '../lib/cn'
import { WEBSITE_DOMAIN } from '../lib/env'
import { usePersistentDocsState } from '../lib/docs-state'

const tags = [
  {
    name: 'All',
    description: '',
    value: undefined,
  },
]

export function CustomSearchDialog(props: SharedProps) {
  const [open, setOpen] = useState(false)
  const [tag, setTag] = useState<string | undefined>()
  const chatId = usePersistentDocsState((state) => state.chatId)

  const { search, setSearch, query } = useDocsSearch({
    type: 'fetch',
    api: chatId ? `/api/search?chatId=${chatId}` : '/api/search',
    tag,
  })

  const items = useMemo(() => {
    if (query.data == 'empty') return null

    return query.data
    // TODO using dangerouslySetInnerHTML can cause problems
    // return query?.data?.map((x) => {
    //     x.content = (
    //         <span dangerouslySetInnerHTML={{ __html: x.content }} />
    //     ) as any
    //     return x
    // })
  }, [query.data])

  return (
    <SearchDialog search={search} onSearchChange={setSearch} isLoading={query.isLoading} {...props}>
      <SearchDialogOverlay />
      <SearchDialogContent>
        <SearchDialogHeader>
          <SearchDialogIcon />
          <SearchDialogInput />
          <SearchDialogClose />
        </SearchDialogHeader>
        <SearchDialogList items={items} />
        {/* <SearchDialogListItem
                    item={{
                        content: 'assistant',
                        id: '_',
                        type: 'page',
                        url: '',
                        external: true,
                    }}
                /> */}
        <SearchDialogFooter className='flex flex-row flex-wrap gap-2 items-center'>
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger
              className={buttonVariants({
                size: 'sm',
                color: 'ghost',
                className: '-m-1.5 me-auto',
              })}
            >
              <span className='text-fd-muted-foreground/80 me-2'>Filter</span>
              {tags.find((item) => item.value === tag)?.name}
              <ChevronDown className='size-3.5 text-fd-muted-foreground' />
            </PopoverTrigger>
            <PopoverContent className='flex flex-col p-1 gap-1' align='start'>
              {tags.map((item, i) => {
                const isSelected = item.value === tag

                return (
                  <button
                    key={i}
                    onClick={() => {
                      setTag(item.value)
                      setOpen(false)
                    }}
                    className={cn(
                      'rounded-lg text-start px-2 py-1.5',
                      isSelected
                        ? 'text-fd-primary bg-fd-primary/10'
                        : 'hover:text-fd-accent-foreground hover:bg-fd-accent',
                    )}
                  >
                    <p className='font-medium mb-0.5'>{item.name}</p>
                    <p className='text-xs opacity-70'>{item.description}</p>
                  </button>
                )
              })}
            </PopoverContent>
          </Popover>
          <a
            href={`https://${WEBSITE_DOMAIN}`}
            rel='noreferrer noopener'
            className='text-xs text-nowrap text-fd-muted-foreground'
          >
            Powered by Holocron
          </a>
        </SearchDialogFooter>
      </SearchDialogContent>
    </SearchDialog>
  )
}
