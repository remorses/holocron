import * as Ariakit from '@ariakit/react'
import classNames from 'clsx'
import { matchSorter } from 'match-sorter'
import * as React from 'react'
import getCaretCoordinates from 'textarea-caret'

import { useChatState } from './chat-provider'
import { cn } from '../lib/cn'
import { ScrollArea } from '../components/ui/scroll-area'

interface MentionsTextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  ref?: any
  disabled?: boolean
  placeholder?: string
  className?: string
  mentionOptions?: string[]
}

export function ChatTextarea({
  disabled = false,
  placeholder = 'Type @',
  className = '',
  mentionOptions,
  ...props
}: MentionsTextAreaProps) {
  const ref = React.useRef<HTMLTextAreaElement>(null)
  const [trigger, setTrigger] = React.useState<string | null>(null)
  const [caretOffset, setCaretOffset] = React.useState<number | null>(null)
  const selectedAutocompleteText = useChatState((x) => x.selectedAutocompleteText)
  const submitForm = useChatState((x) => x.submit)
  const value = useChatState((x) => x.draftText || '')
  function onChange(text: string) {
    useChatState.setState({ draftText: text })
  }

  const messages = useChatState((x) => x.messages)

  const mentionsCombobox = useChatState((x) => x.mentionsCombobox)

  const searchValue = Ariakit.useStoreState(mentionsCombobox, 'value')
  const deferredSearchValue = React.useDeferredValue(searchValue)

  const mentionMatches = React.useMemo(() => {
    return matchSorter(getList(trigger, mentionOptions), deferredSearchValue || '', {
      baseSort: (a, b) => (a.index < b.index ? -1 : 1),
    }).slice(0, 10)
  }, [trigger, deferredSearchValue, mentionOptions])

  const hasMatches = !!mentionMatches.length

  React.useLayoutEffect(() => {
    mentionsCombobox?.setOpen(hasMatches)
  }, [mentionsCombobox, hasMatches])

  React.useLayoutEffect(() => {
    if (caretOffset != null) {
      ref.current?.setSelectionRange(caretOffset, caretOffset)
    }
  }, [caretOffset])

  // Re-calculates the position of the combobox popover in case the changes on
  // the textarea value have shifted the trigger character.
  React.useEffect(() => {
    mentionsCombobox?.render()
  }, [mentionsCombobox, value])

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.isPropagationStopped()) {
      console.log('event is propagation stopped, ignoring enter')
      return
    }
    if (event.defaultPrevented) {
      console.log('event is default prevented, ignoring enter')
      return
    }

    if (event.key === 'Escape') {
      const isGenerating = useChatState.getState().isGenerating
      if (isGenerating) {
        event.preventDefault()
        useChatState.getState().stop()
      }
      return
    }

    // Handle mentions combobox
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      mentionsCombobox?.hide()
    }

    // Handle form submission - prevent if mentions combobox is open or autocomplete is showing
    if (event.key === 'Enter' && !event.shiftKey) {
      if (mentionMatches?.length) {
        return
      }

      event.preventDefault()
      if (!disabled && value.trim()) {
        submitForm()
      }
    }
  }

  const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const trigger = getTrigger(event.target)
    const searchValue = getSearchValue(event.target)
    // If there's a trigger character, we'll show the combobox popover. This can
    // be true both when the trigger character has just been typed and when
    // content has been deleted (e.g., with backspace) and the character right
    // before the caret is the trigger.
    if (trigger) {
      setTrigger(trigger)
      mentionsCombobox?.show()
    }
    // There will be no trigger and no search value if the trigger character has
    // just been deleted.
    else if (!searchValue) {
      setTrigger(null)
      mentionsCombobox?.hide()
    }
    // Sets our textarea value.
    onChange(event.target.value)
    // Sets the combobox value that will be used to search in the list.
    mentionsCombobox?.setValue(searchValue)
  }

  const onMentionClick = (itemValue: string) => () => {
    const textarea = ref.current
    if (!textarea) return
    const offset = getTriggerOffset(textarea)
    const displayValue = getValue(itemValue, trigger, mentionOptions)
    if (!displayValue) return
    setTrigger(null)
    onChange(replaceValue(offset, searchValue || '', displayValue)(value))
    const nextCaretOffset = offset + displayValue.length + 1
    setCaretOffset(nextCaretOffset)
  }

  return (
    <div className='relative flex flex-col'>
      {/* External autocomplete dropdown */}

      <ScrollArea className='[&>div>div]:grow flex flex-col box-border my-1 max-h-28 w-full 2xl:max-h-40'>
        <Ariakit.Combobox
          store={mentionsCombobox}
          autoSelect
          value={selectedAutocompleteText || value}
          // We'll overwrite how the combobox popover is shown, so we disable
          // the default behaviors.
          showOnClick={false}
          showOnChange={false}
          showOnKeyPress={false}
          setValueOnChange={false}
          {...(props as any)}
          className={cn(
            'flex grow min-h-[84px] overflow-auto max-h-full w-full bg-transparent px-4 py-3 text-[15px] resize-none text-foreground placeholder:text-muted-foreground/70 outline-none resize-none',
            className,
          )}
          render={
            <textarea
              // rows={5}
              ref={ref}
              value={value}
              placeholder={placeholder}
              disabled={disabled}
              onKeyDown={handleKeyDown}
              onScroll={mentionsCombobox?.render}
              onPointerDown={mentionsCombobox?.hide}
              onChange={handleChange}
              className='box-border border-0 outline-none [field-sizing:content] whitespace-pre-wrap break-words  '
            />
          }
        />
      </ScrollArea>

      <Ariakit.ComboboxPopover
        store={mentionsCombobox}
        hidden={!hasMatches}
        unmountOnHide
        fitViewport
        getAnchorRect={() => {
          const textarea = ref.current
          if (!textarea) return null
          return getAnchorRect(textarea)
        }}
        className={classNames(
          // Position and layout
          'relative z-50 flex flex-col no-scrollbar text-sm',
          // Size constraints
          'min-w-[140px] max-w-[280px] max-h-[min(var(--popover-available-height,186px),186px)]',
          // Scrolling behavior
          'overflow-auto overscroll-contain',
          // Appearance
          'rounded-md p-1 bg-popover border',
          'outline-2 outline-transparent outline-offset-2',
          'shadow-lg',
        )}
      >
        {mentionMatches.map((value) => (
          <Ariakit.ComboboxItem
            key={value}
            value={value}
            focusOnHover
            onClick={onMentionClick(value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.stopPropagation()
                e.preventDefault()
                e.nativeEvent?.stopImmediatePropagation()
                onMentionClick(value)()
              }
            }}
            className={classNames(
              // Layout
              'flex items-center gap-2',
              // Size and spacing
              'rounded py-1 px-2 scroll-m-1',
              // Interaction
              'cursor-default outline-none',
              // States
              // 'hover:bg-accent hover:text-accent-foreground',
              'data-[active-item]:bg-accent data-[active-item]:text-accent-foreground',
              'active:pt-[9px] active:pb-[7px]',
              'data-[active]:pt-[9px] data-[active]:pb-[7px]',
            )}
          >
            <span className='overflow-hidden text-ellipsis whitespace-nowrap'>{value}</span>
          </Ariakit.ComboboxItem>
        ))}
      </Ariakit.ComboboxPopover>
    </div>
  )
}

export function ChatAutocomplete({ autocompleteSuggestions = [] }: { autocompleteSuggestions?: string[] }) {
  const selectedAutocompleteText = useChatState((state) => state.selectedAutocompleteText)

  const text = useChatState((x) => {
    return x.draftText || ''
  })
  const messages = useChatState((x) => x.messages)

  const filteredSuggestions = React.useMemo(() => {
    if (!text.trim() || messages.length > 0) return []

    return autocompleteSuggestions
      .filter((suggestion) => suggestion.toLowerCase().startsWith(text.toLowerCase()))
      .slice(0, 5)
  }, [text, messages.length])

  // const autocompleteEnabled =
  //     messages.length === 0 &&
  //     value.length > 0 &&
  //     filteredSuggestions.length > 0

  React.useLayoutEffect(() => {
    function handleAutocompleteNavigation(event: KeyboardEvent) {
      // Handle autocomplete navigation when autocomplete is enabled and has items
      if (!filteredSuggestions.length) {
        return
      }
      const selectedAutocompleteText = useChatState.getState()?.selectedAutocompleteText || ''
      const selectedAutocompleteIndex = filteredSuggestions.indexOf(selectedAutocompleteText)
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        const newIndex = selectedAutocompleteIndex < filteredSuggestions.length - 1 ? selectedAutocompleteIndex + 1 : 0
        const selectedAutocompleteText = filteredSuggestions[newIndex]
        useChatState.setState({
          selectedAutocompleteText,
        })

        return
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault()
        const newIndex = selectedAutocompleteIndex > 0 ? selectedAutocompleteIndex - 1 : filteredSuggestions.length - 1
        const selectedAutocompleteText = filteredSuggestions[newIndex]
        useChatState.setState({
          selectedAutocompleteText,
        })
        return
      }
      if (event.key === 'Enter' && selectedAutocompleteIndex >= 0) {
        event.preventDefault()

        event.stopPropagation()
        const selectedAutocompleteText = useChatState.getState()?.selectedAutocompleteText || ''
        useChatState.setState({
          selectedAutocompleteText: undefined,
          draftText: selectedAutocompleteText + ' ',
        })
        return
      }
    }

    window.addEventListener('keydown', handleAutocompleteNavigation, {
      capture: true,
    })
    return () => {
      window.removeEventListener('keydown', handleAutocompleteNavigation, {
        capture: true,
      })
    }
  }, [filteredSuggestions])
  if (!filteredSuggestions.length) {
    return null
  }
  return (
    <div className=' bottom-0 pt-4 absolute translate-y-full left-0 right-0 mb-2 z-10'>
      <div className='rounded-lg shadow-lg p-1'>
        <div className='flex flex-col gap-0.5'>
          {filteredSuggestions.slice(0, 5).map((item, index) => {
            return (
              <button
                key={item}
                className={`w-full px-2 py-1.5 text-left text-sm rounded-md transition-colors ${
                  selectedAutocompleteText === item ? 'bg-muted/70' : 'hover:bg-accent/50'
                }`}
                onClick={() => {
                  useChatState.setState({
                    selectedAutocompleteText: undefined,
                    draftText: item + ' ',
                  })
                }}
              >
                {item}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function getTriggerOffset(element: HTMLTextAreaElement, triggers = defaultTriggers) {
  const { value, selectionStart } = element
  for (let i = selectionStart; i >= 0; i--) {
    const char = value[i]
    if (char && triggers.includes(char)) {
      return i
    }
  }
  return -1
}

function getTrigger(element: HTMLTextAreaElement, triggers = defaultTriggers) {
  const { value, selectionStart } = element
  const previousChar = value[selectionStart - 1]
  if (!previousChar) return null
  const secondPreviousChar = value[selectionStart - 2]
  const isIsolated = !secondPreviousChar || /\s/.test(secondPreviousChar)
  if (!isIsolated) return null
  if (triggers.includes(previousChar)) return previousChar
  return null
}

function getSearchValue(element: HTMLTextAreaElement, triggers = defaultTriggers) {
  const offset = getTriggerOffset(element, triggers)
  if (offset === -1) return ''
  return element.value.slice(offset + 1, element.selectionStart)
}

function getAnchorRect(element: HTMLTextAreaElement, triggers = defaultTriggers) {
  const offset = getTriggerOffset(element, triggers)
  const { left, top, height } = getCaretCoordinates(element, offset + 1)
  const { x, y } = element.getBoundingClientRect()
  return {
    x: left + x - element.scrollLeft,
    y: top + y - element.scrollTop,
    height,
  }
}

function replaceValue(offset: number, searchValue: string, displayValue: string) {
  return (prevValue: string) => {
    const nextValue = `${prevValue.slice(0, offset) + displayValue} ${prevValue.slice(offset + searchValue.length + 1)}`
    return nextValue
  }
}

const defaultTriggers = ['@']

function getList(trigger: string | null, mentionOptions?: string[]) {
  switch (trigger) {
    case '@':
      return mentionOptions ? mentionOptions.map((option) => (option.startsWith('@') ? option.slice(1) : option)) : []
    default:
      return []
  }
}

function getValue(listValue: string, trigger: string | null, mentionOptions?: string[]) {
  if (trigger === '@') {
    if (mentionOptions) {
      const option = mentionOptions.find((opt) => {
        const displayValue = opt.startsWith('@') ? opt.slice(1) : opt
        return displayValue === listValue
      })
      return option || `@${listValue}`
    }
  }
  return null
}
