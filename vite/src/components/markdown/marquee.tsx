'use client'

/**
 * Marquee — infinite scrolling component with customizable speed, direction,
 * fade edges, and progressive slow-on-hover. Works with any children: icons,
 * images, cards, text, etc.
 *
 * Animation is driven by requestAnimationFrame instead of CSS @keyframes so
 * speed changes (hover slow-down) are smooth and progressive — no jumps.
 * Speed lerps toward the target each frame with a configurable easing factor.
 *
 * Adapted for Holocron:
 * - Uses Holocron's cn() utility and CSS tokens
 * - No external dependencies
 */

import React from 'react'
import { cn } from '../../lib/css-vars.ts'

interface MarqueeProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Time in seconds for one full scroll cycle. Lower = faster. More children means more distance covered in the same time, so perceived speed increases with content. */
  duration?: number
  /** Progressively slow down the animation on hover (6x slower). */
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

/** Lerp factor per frame — closer to 0 = smoother/slower transition, closer to 1 = snappier. */
const LERP_FACTOR = 0.04

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
  const items = React.Children.toArray(children)
  const isVertical = direction === 'up' || direction === 'down'
  const isReverse = direction === 'right' || direction === 'down'

  const trackRef = React.useRef<HTMLDivElement>(null)
  const offsetRef = React.useRef(0)
  const speedRef = React.useRef(0) // current pixels-per-ms, set on first measure
  const targetSpeedRef = React.useRef(0)
  const lastTimeRef = React.useRef(0)
  const hoveredRef = React.useRef(false)
  const rafRef = React.useRef(0)
  const measuredRef = React.useRef(false)

  // Compute base speed once the track is measured. Half the track = one content
  // width (children are duplicated). We scroll that distance in `duration` seconds.
  const measureAndSetSpeed = React.useCallback(() => {
    const el = trackRef.current
    if (!el || measuredRef.current) return
    const halfSize = isVertical ? el.scrollHeight / 2 : el.scrollWidth / 2
    if (halfSize === 0) return
    const basePxPerMs = halfSize / (duration * 1000)
    speedRef.current = basePxPerMs
    targetSpeedRef.current = basePxPerMs
    measuredRef.current = true
  }, [duration, isVertical])

  React.useEffect(() => {
    const el = trackRef.current
    if (!el) return

    measureAndSetSpeed()

    const tick = (now: number) => {
      if (!measuredRef.current) measureAndSetSpeed()

      const dt = lastTimeRef.current ? now - lastTimeRef.current : 16
      lastTimeRef.current = now

      // Lerp current speed toward target
      speedRef.current += (targetSpeedRef.current - speedRef.current) * LERP_FACTOR

      const halfSize = isVertical ? el.scrollHeight / 2 : el.scrollWidth / 2
      if (halfSize > 0) {
        offsetRef.current = (offsetRef.current + speedRef.current * dt) % halfSize
        const translate = isReverse ? offsetRef.current : -offsetRef.current
        el.style.transform = isVertical
          ? `translateY(${translate}px)`
          : `translateX(${translate}px)`
      }

      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [isVertical, isReverse, measureAndSetSpeed])

  // Update target speed when hover state changes
  const onEnter = React.useCallback(() => {
    if (!slowOnHover) return
    hoveredRef.current = true
    if (measuredRef.current) {
      const el = trackRef.current
      if (!el) return
      const halfSize = isVertical ? el.scrollHeight / 2 : el.scrollWidth / 2
      targetSpeedRef.current = halfSize / (duration * 6 * 1000)
    }
  }, [slowOnHover, duration, isVertical])

  const onLeave = React.useCallback(() => {
    if (!slowOnHover) return
    hoveredRef.current = false
    if (measuredRef.current) {
      const el = trackRef.current
      if (!el) return
      const halfSize = isVertical ? el.scrollHeight / 2 : el.scrollWidth / 2
      targetSpeedRef.current = halfSize / (duration * 1000)
    }
  }, [slowOnHover, duration, isVertical])

  const maskImage = fade
    ? isVertical
      ? `linear-gradient(to bottom, transparent 0%, black ${fadeAmount}%, black ${100 - fadeAmount}%, transparent 100%)`
      : `linear-gradient(to right, transparent 0%, black ${fadeAmount}%, black ${100 - fadeAmount}%, transparent 100%)`
    : undefined

  return (
    <div
      className={cn(
        'flex w-full overflow-hidden',
        isVertical && 'flex-col',
        className,
      )}
      style={{
        maskImage,
        WebkitMaskImage: maskImage,
      }}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      {...props}
    >
      <div
        ref={trackRef}
        className={cn(
          'flex shrink-0 items-center',
          isVertical && 'flex-col',
        )}
        style={{
          gap: `${gap}px`,
          willChange: 'transform',
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
  )
}
