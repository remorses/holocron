// Full-bleed hero with DottedVideoBackground (Three.js fluid sim), serif title,
// and centered CTA. Breaks out of the Above column constraint via w-screen + negative margin.
'use client'

import { Link } from 'spiceflow/react'
import { Button } from './ui/button.tsx'
import { DottedVideoBackground } from './dotted-video-background.tsx'

const HERO_FONT = "'IvarText', serif"

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
  'color-mix(in srgb, var(--background) 90%, transparent) 10%,',
  'color-mix(in srgb, var(--background) 70%, transparent) 22%,',
  'color-mix(in srgb, var(--background) 40%, transparent) 40%,',
  'color-mix(in srgb, var(--background) 15%, transparent) 60%,',
  'transparent 80%)',
].join(' ')

const BOTTOM_GRADIENT = [
  'linear-gradient(to top,',
  'var(--background) 0%,',
  'color-mix(in srgb, var(--background) 85%, transparent) 15%,',
  'color-mix(in srgb, var(--background) 50%, transparent) 35%,',
  'color-mix(in srgb, var(--background) 20%, transparent) 55%,',
  'transparent 75%)',
].join(' ')

export function HeroSection() {
  return (
    <div className='relative mt-4 lg:mt-8 mb-6 lg:mb-10 w-screen ml-[calc(-50vw+50%)] flex flex-col items-center overflow-hidden'>
      {/* Three.js dotted video background */}
      <div
        className='absolute inset-0 w-full h-full z-0 overflow-hidden dark:opacity-60 opacity-40'
        style={{
          maskImage:
            'linear-gradient(to bottom, black 60%, transparent 100%)',
          WebkitMaskImage:
            'linear-gradient(to bottom, black 60%, transparent 100%)',
        }}
      >
        <DottedVideoBackground
          className='w-full h-full'
          config={{
            dotColor: '#8da4ff',
            dotSize: 6,
            minDotSize: 1,
            dotMargin: 1,
            animSpeed: 3,
            gamma: 0.8,
            enableMask: false,
            fluidStrength: 0.2,
            fluidCurl: 80,
          }}
        />
      </div>

      {/* Top gradient overlay */}
      <div
        className='absolute top-0 inset-x-0 h-[60%] z-[1] pointer-events-none'
        style={{ background: TOP_GRADIENT }}
      />

      {/* Bottom gradient overlay */}
      <div
        className='absolute bottom-0 inset-x-0 h-[40%] z-[1] pointer-events-none'
        style={{ background: BOTTOM_GRADIENT }}
      />

      {/* Foreground content */}
      <div className='relative z-[2] flex flex-col items-center justify-center text-center max-w-[820px] w-full px-5 pt-16 sm:pt-24 pb-20 lg:pb-[160px] gap-6'>
        <h1
          className='flex flex-col items-center leading-none text-[40px] sm:text-[56px] md:text-[68px] text-foreground'
          style={{ fontFamily: HERO_FONT }}
        >
          <span>delightful docs</span>
          <span>for humans &amp; agents</span>
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
