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

export function MentionsTextArea() {
    const ref = React.useRef<HTMLTextAreaElement>(null)
    const [value, setValue] = React.useState('')
    const [trigger, setTrigger] = React.useState<string | null>(null)
    const [caretOffset, setCaretOffset] = React.useState<number | null>(null)

    const combobox = Ariakit.useComboboxStore()

    const searchValue = Ariakit.useStoreState(combobox, 'value')
    const deferredSearchValue = React.useDeferredValue(searchValue)

    const matches = React.useMemo(() => {
        return matchSorter(getList(trigger), deferredSearchValue, {
            baseSort: (a, b) => (a.index < b.index ? -1 : 1),
        }).slice(0, 10)
    }, [trigger, deferredSearchValue])

    const hasMatches = !!matches.length

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

    const onKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
            combobox.hide()
        }
    }

    const onChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
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
        setValue(event.target.value)
        // Sets the combobox value that will be used to search in the list.
        combobox.setValue(searchValue)
    }

    const onItemClick = (value: string) => () => {
        const textarea = ref.current
        if (!textarea) return
        const offset = getTriggerOffset(textarea)
        const displayValue = getValue(value, trigger)
        if (!displayValue) return
        setTrigger(null)
        setValue(replaceValue(offset, searchValue, displayValue))
        const nextCaretOffset = offset + displayValue.length + 1
        setCaretOffset(nextCaretOffset)
    }

    return (
        <div className='flex flex-col gap-2'>
            <Ariakit.Combobox
                store={combobox}
                autoSelect
                value={value}
                // We'll overwrite how the combobox popover is shown, so we disable
                // the default behaviors.
                showOnClick={false}
                showOnChange={false}
                showOnKeyPress={false}
                // To the combobox state, we'll only set the value after the trigger
                // character (the search value), so we disable the default behavior.
                setValueOnChange={false}
                className='p-2 py-2 shrink-0 leading-relaxed mt-1 w-full min-h-[80px]'
                render={
                    <textarea
                        ref={ref}
                        rows={5}
                        placeholder='Type @, # or :'
                        // We need to re-calculate the position of the combobox popover
                        // when the textarea contents are scrolled.
                        onScroll={combobox.render}
                        // Hide the combobox popover whenever the selection changes.
                        onPointerDown={combobox.hide}
                        onChange={onChange}
                        onKeyDown={onKeyDown}
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
                    'relative z-50 flex flex-col no-scrollbar text-xs',
                    // Size constraints
                    'min-w-[140px] max-w-[280px] max-h-[min(var(--popover-available-height,186px),186px)]',
                    // Scrolling behavior
                    'overflow-auto overscroll-contain',
                    // Appearance
                    'rounded-md p-1 bg-framer-secondary',
                    'outline-2 outline-transparent outline-offset-2',
                    'shadow-lg',
                )}
            >
                {matches.map((value) => (
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
                            'hover:bg-framer-secondary',
                            'data-[active-item]:bg-framer-tint ',
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
