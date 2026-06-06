// Full-bleed hero with VideoBackgroundShader, serif title, and centered CTA.
// Breaks out of the Above column constraint via w-screen + negative margin.
'use client'

import { useEffect, useState } from 'react'
import { Link } from 'spiceflow/react'
import { Button } from './ui/button.tsx'
import { VideoBackgroundShader } from '@holocron.so/vite/mdx'

const HERO_FONT = "'IvarText', serif"

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox='0 0 24 24' fill='currentColor'>
      <path d='M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z' />
    </svg>
  )
}

export function HeroSection({}) {
  const [fontsReady, setFontsReady] = useState(false)

  useEffect(() => {
    const timeout = setTimeout(() => setFontsReady(true), 3000)
    document.fonts.ready.then(() => setFontsReady(true))
    return () => clearTimeout(timeout)
  }, [])

  return (
    <div className='relative mt-4 lg:mt-8 mb-6 lg:mb-10 w-screen ml-[calc(-50vw+50%)] flex flex-col items-center overflow-hidden'>
      <VideoBackgroundShader
        src='/hero-bg.mp4'
        className='absolute inset-0 w-full h-full'
        canvasClassName='dark:opacity-60 opacity-40'
        dotStyle='ascii'
        dotColor='#8da4ff'
        dotSize={10}
        // minDotSize={1}
        // dotMargin={1}
        // animSpeed={3}
        chars= ' .:-~=holocron'
        // gamma={0.8}
        // fluidStrength={0.6}
        // fluidCurl={80}
        //         minLuminance={0.15}
      />

      {/* Foreground content */}
      <div
        className='relative z-[2] flex flex-col items-center justify-center text-center max-w-[820px] mx-auto w-full px-5 py-20 sm:py-28 lg:py-[140px] gap-6'
        style={{
          opacity: fontsReady ? 1 : 0,
          transition: 'opacity 0.3s cubic-bezier(0.23, 1, 0.32, 1)',
        }}
      >
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
            {/* External URL → plain <a>; spiceflow's Link only types internal routes. */}
            <a href='https://github.com/remorses/holocron' target='_blank' rel='noopener noreferrer'>
              GitHub Repo ↗
            </a>
          </Button>
        </div>
      </div>
    </div>
  )
}
