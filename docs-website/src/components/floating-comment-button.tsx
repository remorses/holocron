'use client'

import { MessageCircleIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useLocation } from 'react-router'
import { useFloating, offset, flip, shift } from '@floating-ui/react'
import { useDocsState, usePersistentDocsState, generateChatId, saveChatMessages } from '../lib/docs-state'
import { cn } from '../lib/cn'
import * as cookie from 'cookie'
import { CONTESTO_DRAFT_MESSAGE_KEY } from 'contesto/src/lib/constants'

export function FloatingCommentButton() {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null)
  const location = useLocation()
  const { refs, floatingStyles } = useFloating({
    elements: {
      reference: anchorEl,
    },
    placement: 'right',
    middleware: [],
  })

  useEffect(() => {
    const article = document.querySelector('.docs-page-article')
    if (!article) return

    let leaveTimeout: NodeJS.Timeout

    const handleMouseEnter = (e: Event) => {
      const target = (e.target as HTMLElement).closest('[data-commentable]')
      if (target && target instanceof HTMLElement) {
        clearTimeout(leaveTimeout)
        setAnchorEl(target)
      }
    }

    const handleMouseLeave = (e: Event) => {
      const target = (e.target as HTMLElement).closest('[data-commentable]')
      if (target) {
        leaveTimeout = setTimeout(() => {
          setAnchorEl(null)
        }, 1000)
      }
    }

    article.addEventListener('mouseenter', handleMouseEnter, true)
    article.addEventListener('mouseleave', handleMouseLeave, true)

    return () => {
      article.removeEventListener('mouseenter', handleMouseEnter, true)
      article.removeEventListener('mouseleave', handleMouseLeave, true)
      clearTimeout(leaveTimeout)
    }
  }, [])

  const handleClick = () => {
    if (!anchorEl) return

    const startLine = parseInt(anchorEl.getAttribute('data-comment-line-start') || '0', 10)
    const endLine = parseInt(anchorEl.getAttribute('data-comment-line-end') || '0', 10)
    const headingId = anchorEl.id || ''

    // Build currentSlug with hash if heading has ID
    const currentSlug = headingId ? `${location.pathname}#${headingId}` : location.pathname

    useDocsState.setState({
      highlightedLines: {
        slug: location.pathname,
        startLine,
        endLine,
      },
      currentSlug,
    })

    const chatId = usePersistentDocsState.getState().chatId
    
    // Clear chat history
    saveChatMessages(chatId, [])

    // Set initial prompt message via cookie
    const encodedValue = encodeURIComponent('I have some feedback: ')
    document.cookie = cookie.serialize(CONTESTO_DRAFT_MESSAGE_KEY, encodedValue, {
      path: '/',
      maxAge: 60 * 60, // 1 hour
    })

    usePersistentDocsState.setState({ drawerState: 'open' })
  }

  if (!anchorEl) return null

  return (
    <div
      ref={refs.setFloating}
      style={floatingStyles}
      className={cn('hidden md:block z-50')}
    >
      <button
        onClick={handleClick}
        onMouseEnter={() => {
          setAnchorEl(anchorEl)
        }}
        className={cn(
          'p-1.5 rounded hover:bg-accent',
          'text-muted-foreground hover:text-foreground',
          'transition-colors',
          'bg-background border border-border shadow-sm',
        )}
        aria-label='Comment on this section'
      >
        <MessageCircleIcon className='size-4' />
      </button>
    </div>
  )
}
