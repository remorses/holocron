'use client'

import * as React from 'react'
import { Check, ChevronsUpDown } from 'lucide-react'

import { cn } from 'website/src/lib/utils'
import { Badge } from './badge'
import { Button } from 'website/src/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from 'website/src/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from 'website/src/components/ui/popover'

interface ComboboxProps {
  value?: string
  onValueChange?: (value: string) => void
  placeholder?: string
  searchPlaceholder?: string
  emptyText?: string
  className?: string
  items: Array<{
    value: string
    label: string
    branch?: string
  }>
}

export function Combobox({
  value,
  onValueChange,
  placeholder = 'Select item...',
  searchPlaceholder = 'Search...',
  emptyText = 'No item found.',
  className,
  items,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant='secondary'
          role='combobox'
          aria-expanded={open}
          className={cn('justify-between max-w-full', className)}
        >
          <span className='truncate'>{value ? items.find((item) => item.value === value)?.label : placeholder}</span>
          <ChevronsUpDown className='ml-2 h-4 w-4 shrink-0 opacity-50' />
        </Button>
      </PopoverTrigger>
      <PopoverContent className='p-0 max-w-full' align='start'>
        <Command>
          <CommandInput placeholder={searchPlaceholder} className='h-9' />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {items.map((item) => (
                <CommandItem
                  key={item.value}
                  value={item.value}
                  onSelect={(currentValue) => {
                    onValueChange?.(currentValue === value ? '' : currentValue)
                    setOpen(false)
                  }}
                  className='max-w-full'
                >
                  <div className='flex items-center justify-between gap-4 min-w-0 w-full'>
                    <span className='truncate'>{item.label}</span>
                    {item.branch && (
                      <Badge variant='outline' className='text-xs shrink-0 truncate'>
                        {item.branch}
                      </Badge>
                    )}
                  </div>
                  <Check
                    className={cn('ml-auto h-4 w-4 shrink-0', value === item.value ? 'opacity-100' : 'opacity-0')}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
