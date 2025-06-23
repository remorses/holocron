import * as Ariakit from '@ariakit/react'
import classNames from 'clsx'
import { matchSorter } from 'match-sorter'
import * as React from 'react'
import { getList, getValue } from './list'
import {
    getAnchorRect,
    getSearchValue,
    getTrigger,
    getTriggerOffset,
    replaceValue,
} from './utils'

interface MentionsTextAreaProps {
    value: string
    onChange: (value: string) => void
    onSubmit: () => void
    disabled?: boolean
    placeholder?: string
    className?: string
    autocompleteEnabled?: boolean
    autocompleteStrings?: string[]
    onAutocompleteSelect?: (item: string) => void
}

export function MentionsTextArea({
    value,
    onChange,
    onSubmit,
    disabled = false,
    placeholder = 'Type @, # or :',
    className = '',
    autocompleteEnabled = false,
    autocompleteStrings = [],
    onAutocompleteSelect,
}: MentionsTextAreaProps) {
    const ref = React.useRef<HTMLTextAreaElement>(null)
    const [trigger, setTrigger] = React.useState<string | null>(null)
    const [caretOffset, setCaretOffset] = React.useState<number | null>(null)
    const [selectedAutocompleteIndex, setSelectedAutocompleteIndex] =
        React.useState(-1)

    const combobox = Ariakit.useComboboxStore()

    const searchValue = Ariakit.useStoreState(combobox, 'value')
    const deferredSearchValue = React.useDeferredValue(searchValue)

    const mentionMatches = React.useMemo(() => {
        return matchSorter(getList(trigger), deferredSearchValue, {
            baseSort: (a, b) => (a.index < b.index ? -1 : 1),
        }).slice(0, 10)
    }, [trigger, deferredSearchValue])

    const hasMatches = !!mentionMatches.length

    React.useLayoutEffect(() => {
        combobox.setOpen(hasMatches)
    }, [combobox, hasMatches])

    React.useLayoutEffect(() => {
        if (caretOffset != null) {
            ref.current?.setSelectionRange(caretOffset, caretOffset)
        }
    }, [caretOffset])

    // Re-calculates the position of the combobox popover in case the changes on
    // the textarea value have shifted the trigger character.
    React.useEffect(combobox.render, [combobox, value])

    const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
        // Handle autocomplete navigation when autocomplete is enabled and has items
        if (autocompleteEnabled && autocompleteStrings.length > 0) {
            if (event.key === 'ArrowDown') {
                event.preventDefault()
                const newIndex =
                    selectedAutocompleteIndex < autocompleteStrings.length - 1
                        ? selectedAutocompleteIndex + 1
                        : 0
                onAutocompleteSelect?.(autocompleteStrings[newIndex])
                setSelectedAutocompleteIndex(newIndex)
                return
            }
            if (event.key === 'ArrowUp') {
                event.preventDefault()
                const newIndex =
                    selectedAutocompleteIndex > 0
                        ? selectedAutocompleteIndex - 1
                        : autocompleteStrings.length - 1
                onAutocompleteSelect?.(autocompleteStrings[newIndex])
                setSelectedAutocompleteIndex(newIndex)
                return
            }
            if (event.key === 'Enter' && selectedAutocompleteIndex >= 0) {
                event.preventDefault()
                onAutocompleteSelect?.(
                    autocompleteStrings[selectedAutocompleteIndex],
                )
                setSelectedAutocompleteIndex(-1)
                return
            }
        }

        // Handle mentions combobox
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
            combobox.hide()
        }

        // Handle form submission - prevent if mentions combobox is open or autocomplete is showing
        if (event.key === 'Enter' && !event.shiftKey) {
            if (mentionMatches?.length) {
                return
            }

            event.preventDefault()
            if (!disabled && value.trim()) {
                onSubmit()
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
            combobox.show()
        }
        // There will be no trigger and no search value if the trigger character has
        // just been deleted.
        else if (!searchValue) {
            setTrigger(null)
            combobox.hide()
        }
        // Sets our textarea value.
        onChange(event.target.value)
        // Sets the combobox value that will be used to search in the list.
        combobox.setValue(searchValue)
    }

    const onItemClick = (itemValue: string) => () => {
        const textarea = ref.current
        if (!textarea) return
        const offset = getTriggerOffset(textarea)
        const displayValue = getValue(itemValue, trigger)
        if (!displayValue) return
        setTrigger(null)
        onChange(replaceValue(offset, searchValue, displayValue)(value))
        const nextCaretOffset = offset + displayValue.length + 1
        setCaretOffset(nextCaretOffset)
    }

    return (
        <div className='relative flex flex-col gap-2'>
            {/* External autocomplete dropdown */}
            {autocompleteEnabled && autocompleteStrings.length > 0 && (
                <div className='absolute bottom-full left-0 right-0 mb-2 z-10'>
                    <div className='rounded-lg shadow-lg p-1'>
                        <div className='flex flex-col gap-0.5'>
                            {autocompleteStrings
                                .slice(0, 5)
                                .map((item, index) => {
                                    return (
                                        <button
                                            key={item}
                                            className={`w-full px-2 py-1.5 text-left text-sm rounded-md transition-colors ${
                                                selectedAutocompleteIndex ===
                                                index
                                                    ? 'bg-background'
                                                    : 'hover:bg-accent/50'
                                            }`}
                                            onClick={() => {
                                                onAutocompleteSelect?.(item)
                                                setSelectedAutocompleteIndex(-1)
                                            }}
                                        >
                                            {item}
                                        </button>
                                    )
                                })}
                        </div>
                    </div>
                </div>
            )}
            <Ariakit.Combobox
                store={combobox}
                autoSelect
                value={value}
                // We'll overwrite how the combobox popover is shown, so we disable
                // the default behaviors.
                showOnClick={false}
                showOnChange={false}
                showOnKeyPress={false}
                setValueOnChange={false}
                className={`p-2 py-2 shrink-0 leading-relaxed mt-1 w-full min-h-[80px] ${className}`}
                render={
                    <textarea
                        ref={ref}
                        rows={5}
                        placeholder={placeholder}
                        disabled={disabled}
                        // We need to re-calculate the position of the combobox popover
                        // when the textarea contents are scrolled.
                        onScroll={combobox.render}
                        // Hide the combobox popover whenever the selection changes.
                        onKeyDown={handleKeyDown}
                        onPointerDown={combobox.hide}
                        onChange={handleChange}
                    />
                }
            />

            <Ariakit.ComboboxPopover
                store={combobox}
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
                        onClick={onItemClick(value)}
                        className={classNames(
                            // Layout
                            'flex items-center gap-2',
                            // Size and spacing
                            'rounded py-1 px-2 scroll-m-1',
                            // Interaction
                            'cursor-default outline-none',
                            // States
                            'hover:bg-accent hover:text-accent-foreground',
                            'data-[active-item]:bg-accent data-[active-item]:text-accent-foreground',
                            'active:pt-[9px] active:pb-[7px]',
                            'data-[active]:pt-[9px] data-[active]:pb-[7px]',
                        )}
                    >
                        <span className='overflow-hidden text-ellipsis whitespace-nowrap'>
                            {value}
                        </span>
                    </Ariakit.ComboboxItem>
                ))}
            </Ariakit.ComboboxPopover>
        </div>
    )
}
