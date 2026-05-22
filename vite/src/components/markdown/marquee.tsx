'use client'

/**
 * Marquee — infinite scrolling component with customizable speed, direction,
 * fade edges, and slow-on-hover. Works with any children: icons, images,
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
  /** Slow down the animation when the user hovers (3x slower). */
  slowOnHover?: boolean
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
  slowOnHover = true,
  direction = 'left',
  fade = true,
  fadeAmount = 10,
  gap = 24,
  ...props
}: MarqueeProps) {
  const id = React.useId().replace(/:/g, '')
  const [isHovered, setIsHovered] = React.useState(false)

  const items = React.Children.toArray(children)
  const isVertical = direction === 'up' || direction === 'down'
  const isReverse = direction === 'right' || direction === 'down'

  const animationName = `marquee-${id}`
  const keyframes = [
    isVertical
      ? `@keyframes ${animationName} { from { transform: translateY(0); } to { transform: translateY(-50%); } }`
      : `@keyframes ${animationName} { from { transform: translateX(0); } to { transform: translateX(-50%); } }`,
    // Transition-like slow-down: the inner div has two class states with different durations.
    // CSS cannot transition animation-duration, so we use two classes and swap them.
    `.${animationName}-track { animation: ${animationName} ${duration}s linear infinite; }`,
    `.${animationName}-track.slow { animation-duration: ${duration * 3}s; }`,
  ].join('\n')

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
        onMouseEnter={() => slowOnHover && setIsHovered(true)}
        onMouseLeave={() => slowOnHover && setIsHovered(false)}
        {...props}
      >
        <div
          className={cn(
            'flex shrink-0 items-center',
            isVertical && 'flex-col',
            `${animationName}-track`,
            isHovered && 'slow',
          )}
          style={{
            gap: `${gap}px`,
            animationDirection: isReverse ? 'reverse' : 'normal',
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
