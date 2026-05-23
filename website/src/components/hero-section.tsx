// Full-bleed hero with background video, non-linear gradient overlays, and centered CTA.
// Breaks out of the Above column constraint via w-screen + negative margin.
// Video is color-corrected so its black matches --background; inverted in light mode.
'use client'

import { Link } from 'spiceflow/react'
import { Button } from './ui/button.tsx'

const SERIF_FONT = 'Georgia, serif'

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox='0 0 24 24' fill='currentColor'>
      <path d='M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z' />
    </svg>
  )
}

const TOP_GRADIENT = [
  'linear-gradient(to bottom,',
  'var(--background) 0%,',
  'color-mix(in srgb, var(--background) 92%, transparent) 8%,',
  'color-mix(in srgb, var(--background) 78%, transparent) 16%,',
  'color-mix(in srgb, var(--background) 60%, transparent) 26%,',
  'color-mix(in srgb, var(--background) 40%, transparent) 38%,',
  'color-mix(in srgb, var(--background) 20%, transparent) 52%,',
  'color-mix(in srgb, var(--background) 8%, transparent) 68%,',
  'transparent 85%)',
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
    <div className='relative mt-4 lg:mt-8 mb-6 lg:mb-10 w-screen ml-[calc(-50vw+50%)] flex flex-col items-center overflow-hidden bg-background'>
      {/* Background video — width-based sizing, capped to the site grid, centered */}
      <video
        autoPlay
        muted
        loop
        playsInline
        poster='/hero-bg-poster.jpg'
        className='absolute z-0 invert hue-rotate-290 dark:invert-0 dark:hue-rotate-0 w-full max-w-(--grid-max-width) left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2'
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
      <div className='relative z-2 flex flex-col items-center text-center max-w-[720px] w-full px-5 pb-20 lg:pb-[160px] gap-6'>
        <h1 className='flex flex-col items-center leading-tight'>
          <span
            className='italic text-[28px] sm:text-[38px] md:text-[48px] font-normal text-foreground'
            style={{ fontFamily: SERIF_FONT }}
          >
            delightful docs
          </span>
          <span
            className='italic text-[28px] sm:text-[38px] md:text-[48px] font-normal text-foreground -mt-0.5 sm:-mt-1'
            style={{ fontFamily: SERIF_FONT }}
          >
            for humans &amp; agents
          </span>
        </h1>

        {/* CTAs */}
        <div className='flex gap-3 flex-wrap justify-center'>
          <Button asChild size='lg' className='no-underline gap-2.5'>
            <Link href='/dashboard'>
              <GitHubIcon className='size-[18px]' />
              Login with GitHub
            </Link>
          </Button>
          <Button asChild variant='ghost' size='lg' className='no-underline gap-2'>
            <Link href='https://github.com/remorses/holocron' target='_blank' rel='noopener noreferrer'>
              GitHub ↗
            </Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
