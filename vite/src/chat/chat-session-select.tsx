'use client'

/**
 * Chat session switcher — shadcn-select-styled dropdown shown in the drawer
 * top bar. The trigger displays the current conversation's title (AI-generated
 * server-side; a first-message preview is the placeholder until the title
 * chunk arrives). The menu lists a "New chat" action plus past sessions from
 * localStorage; picking one restores its server snapshot via switchChatSession().
 *
 * Built on Radix DropdownMenu with modal={false} instead of Radix Select on
 * purpose: Select hardcodes a body scroll lock (react-remove-scroll-bar) that
 * forces `margin-right !important` on <body>. Host pages centered with
 * `margin-inline: auto` (like the widget example) get pushed sideways by that
 * override. Non-modal DropdownMenu applies zero body mutations.
 */

import React, { useEffect, useSyncExternalStore } from 'react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { chatWidgetStore } from './chat-widget-store.ts'
import { hydrateStoredSessions, sessionLabel } from './chat-sessions.ts'
import { switchChatSession } from './chat-submit.ts'
import { CheckIcon, ChevronDownIcon, PlusIcon } from './chat-icons.tsx'

const NEW_CHAT_LABEL = 'New chat'

const itemClass =
  'relative flex w-full cursor-default items-center rounded-sm py-1.5 pr-8 pl-2 text-sm text-foreground outline-none select-none data-[highlighted]:bg-foreground/8 data-disabled:pointer-events-none data-disabled:opacity-50'

export function ChatSessionSelect({ onNewChat }: { onNewChat: () => void }) {
  // chatWidgetStore.subscribe is a stable reference (zustand store method),
  // so passing it directly never re-subscribes across renders.
  const sessions = useSyncExternalStore(
    chatWidgetStore.subscribe,
    () => chatWidgetStore.getState().sessions,
    () => chatWidgetStore.getState().sessions,
  )
  const sessionId = useSyncExternalStore(
    chatWidgetStore.subscribe,
    () => chatWidgetStore.getState().sessionId,
    () => null,
  )
  const portalTarget = useSyncExternalStore(
    chatWidgetStore.subscribe,
    () => chatWidgetStore.getState().portalTarget || document.body,
    () => null,
  )

  // Load the stored session list once the drawer renders on the client.
  useEffect(() => {
    const { chatApiUrl } = chatWidgetStore.getState()
    if (chatApiUrl) hydrateStoredSessions(chatApiUrl)
  }, [])

  const current = sessions.find((s) => s.id === sessionId)

  // Picking "New chat" focuses the chat input (via onNewChat). Radix would
  // return focus to the trigger when the menu closes, clobbering that focus
  // — suppress the close auto-focus for that one case.
  const newChatSelectedRef = React.useRef(false)

  return (
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger
        aria-label='Chat sessions'
        className='flex h-8 min-w-0 max-w-55 items-center justify-between gap-2 rounded-md bg-transparent px-3 text-sm font-medium whitespace-nowrap text-foreground outline-none hover:bg-muted focus-visible:bg-muted data-[state=open]:bg-muted'
      >
        <span className='truncate'>
          {current ? sessionLabel(current) : NEW_CHAT_LABEL}
        </span>
        <span className='shrink-0 text-muted-foreground opacity-70'>
          <ChevronDownIcon size={14} />
        </span>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal container={portalTarget ?? undefined}>
        <DropdownMenu.Content
          sideOffset={4}
          align='start'
          style={{ zIndex: 300 }}
          onCloseAutoFocus={(event) => {
            if (newChatSelectedRef.current) {
              newChatSelectedRef.current = false
              event.preventDefault()
            }
          }}
          className='holocron-dropdown-content max-h-80 w-60 overflow-x-hidden overflow-y-auto rounded-lg bg-muted p-1 text-foreground shadow-md'
        >
          <DropdownMenu.Item
            onSelect={() => {
              newChatSelectedRef.current = true
              onNewChat()
            }}
            className={itemClass}
          >
            <span className='mr-2 flex size-4 items-center justify-center text-muted-foreground'>
              <PlusIcon size={14} />
            </span>
            {NEW_CHAT_LABEL}
          </DropdownMenu.Item>

          {sessions.length > 0 && (
            <DropdownMenu.Separator className='-mx-1 my-1 h-px bg-foreground/10' />
          )}

          <DropdownMenu.RadioGroup
            value={sessionId ?? ''}
            onValueChange={(next) => {
              if (next) void switchChatSession(next)
            }}
          >
            {sessions.map((session) => (
              <DropdownMenu.RadioItem
                key={session.id}
                value={session.id}
                className={itemClass}
              >
                <span className='truncate'>{sessionLabel(session)}</span>
                <span className='absolute right-2 flex size-3.5 items-center justify-center'>
                  <DropdownMenu.ItemIndicator>
                    <CheckIcon size={13} />
                  </DropdownMenu.ItemIndicator>
                </span>
              </DropdownMenu.RadioItem>
            ))}
          </DropdownMenu.RadioGroup>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
