// Full-bleed hero with background video, non-linear gradient overlays, and centered CTA.
// Breaks out of the Above column constraint via w-screen + negative margin.
// Video is color-corrected so its black matches --background; inverted in light mode.
'use client'

import { Link } from 'spiceflow/react'
import { Button } from './ui/button.tsx'

const TOP_GRADIENT = [
  'linear-gradient(to bottom,',
  'var(--background) 0%,',
  'color-mix(in srgb, var(--background) 97%, transparent) 10%,',
  'color-mix(in srgb, var(--background) 92%, transparent) 20%,',
  'color-mix(in srgb, var(--background) 82%, transparent) 30%,',
  'color-mix(in srgb, var(--background) 82%, transparent) 42%,',
  'color-mix(in srgb, var(--background) 45%, transparent) 55%,',
  'color-mix(in srgb, var(--background) 25%, transparent) 67%,',
  'color-mix(in srgb, var(--background) 12%, transparent) 78%,',
  'color-mix(in srgb, var(--background) 4%, transparent) 88%,',
  'transparent 100%)',
].join(' ')

const BOTTOM_GRADIENT = [
  'linear-gradient(to top,',
  'var(--background) 0%,',
  'color-mix(in srgb, var(--background) 90%, transparent) 10%,',
  'color-mix(in srgb, var(--background) 70%, transparent) 20%,',
  'color-mix(in srgb, var(--background) 45%, transparent) 35%,',
  'color-mix(in srgb, var(--background) 20%, transparent) 50%,',
  'color-mix(in srgb, var(--background) 8%, transparent) 65%,',
  'transparent 80%)',
].join(' ')

export function HeroSection() {
  return (
    <div className='relative mt-12 lg:mt-[100px] mb-6 lg:mb-12 w-screen ml-[calc(-50vw+50%)] flex flex-col items-center overflow-hidden bg-background'>
      {/* Background video — width-based sizing, capped to the site grid, centered */}
      <video
        autoPlay
        muted
        loop
        playsInline
        poster='/hero-bg-poster.jpg'
        className='absolute z-0 invert hue-rotate-290 dark:invert-0 dark:hue-rotate-0 w-full max-w-(--grid-max-width) left-1/2 -translate-x-1/2 top-0'
      >
        <source src='/hero-bg.mp4' type='video/mp4' />
      </video>

      {/* Top gradient */}
      <div
        className='absolute top-0 inset-x-0 h-[70%] z-1 pointer-events-none'
        style={{ background: TOP_GRADIENT }}
      />

      {/* Bottom gradient */}
      <div
        className='absolute bottom-0 inset-x-0 h-[40%] z-1 pointer-events-none'
        style={{ background: BOTTOM_GRADIENT }}
      />

      {/* Foreground content */}
      <div className='relative z-2 flex flex-col items-center text-center max-w-[720px] w-full px-5 pb-32 lg:pb-[300px] gap-5 lg:gap-6'>
        <h1 className='text-[clamp(2.2rem,6vw,4.5rem)] font-bold leading-[1.05] tracking-[-0.03em] text-foreground'>
          Delightful Docs.
        </h1>

        <div className='text-[clamp(0.95rem,2vw,1.25rem)] leading-relaxed text-muted-foreground max-w-[520px]'>
          Mintlify drop-in replacement as a Vite plugin. Own your docs, ship with Git, build locally.
        </div>

        {/* CTAs */}
        <div className='flex gap-3 mt-2 flex-wrap justify-center'>
          <Button asChild size='lg' className='no-underline'>
            <Link href='/components'>Get Started</Link>
          </Button>
          <Button asChild variant='outline' size='lg' className='no-underline'>
            <Link href='https://github.com/remorses/holocron' target='_blank' rel='noopener noreferrer'>
              GitHub
            </Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
