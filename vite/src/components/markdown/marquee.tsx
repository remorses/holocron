'use client'

/**
 * Marquee — infinite scrolling component with customizable speed, direction,
 * fade edges, and pause-on-hover. Works with any children: icons, images,
 * cards, text, etc.
 *
 * Ported from spell.sh/spell-ui with adaptations for Holocron:
 * - Uses React.useId() for scoped keyframe names (multiple marquees per page)
 * - Uses Holocron's cn() utility and CSS tokens
 * - No external dependencies (no styled-jsx, no cn from shadcn)
 */

import React from 'react'
import { cn } from '../../lib/css-vars.ts'

interface MarqueeProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Time in seconds for one full scroll cycle. Lower = faster. More children means more distance covered in the same time, so perceived speed increases with content. */
  duration?: number
  /** Pause the animation when the user hovers. */
  pauseOnHover?: boolean
  /** Scroll direction. */
  direction?: 'left' | 'right' | 'up' | 'down'
  /** Show fade gradient at the edges. */
  fade?: boolean
  /** Percentage of fade gradient width (0-100). */
  fadeAmount?: number
  /** Gap between items in pixels. */
  gap?: number
}

export function Marquee({
  children,
  className,
  duration = 20,
  pauseOnHover = false,
  direction = 'left',
  fade = true,
  fadeAmount = 10,
  gap = 24,
  ...props
}: MarqueeProps) {
  const id = React.useId().replace(/:/g, '')
  const [isPaused, setIsPaused] = React.useState(false)

  const items = React.Children.toArray(children)
  const isVertical = direction === 'up' || direction === 'down'
  const isReverse = direction === 'right' || direction === 'down'

  const animationName = `marquee-${id}`
  const keyframes = isVertical
    ? `@keyframes ${animationName} { from { transform: translateY(0); } to { transform: translateY(-50%); } }`
    : `@keyframes ${animationName} { from { transform: translateX(0); } to { transform: translateX(-50%); } }`

  const maskImage = fade
    ? isVertical
      ? `linear-gradient(to bottom, transparent 0%, black ${fadeAmount}%, black ${100 - fadeAmount}%, transparent 100%)`
      : `linear-gradient(to right, transparent 0%, black ${fadeAmount}%, black ${100 - fadeAmount}%, transparent 100%)`
    : undefined

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: keyframes }} />
      <div
        className={cn(
          'flex w-full my-6 overflow-hidden',
          isVertical && 'flex-col',
          className,
        )}
        style={{
          maskImage,
          WebkitMaskImage: maskImage,
        }}
        onMouseEnter={() => pauseOnHover && setIsPaused(true)}
        onMouseLeave={() => pauseOnHover && setIsPaused(false)}
        {...props}
      >
        <div
          className={cn(
            'flex shrink-0 items-center',
            isVertical && 'flex-col',
          )}
          style={{
            gap: `${gap}px`,
            animation: `${animationName} ${duration}s linear infinite`,
            animationDirection: isReverse ? 'reverse' : 'normal',
            animationPlayState: isPaused ? 'paused' : 'running',
          }}
        >
          {items.map((item, i) => (
            <div key={`a-${i}`} className={cn('flex shrink-0', isVertical && 'w-full')}>
              {item}
            </div>
          ))}
          {items.map((item, i) => (
            <div key={`b-${i}`} className={cn('flex shrink-0', isVertical && 'w-full')} aria-hidden='true'>
              {item}
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
