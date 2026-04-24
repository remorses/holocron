// Full-bleed hero with background video, non-linear gradient overlays, and centered CTA.
// Breaks out of the Above column constraint via w-screen + negative margin.
// Video is color-corrected so its black matches --background; inverted in light mode.
'use client'

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
    <div className='relative mt-[100px] w-screen ml-[calc(-50vw+50%)] flex flex-col items-center overflow-hidden bg-background mb-12'>
      {/* Background video — width-based sizing, capped at 1500px, centered */}
      <video
        autoPlay
        muted
        loop
        playsInline
        className='absolute z-0 invert hue-rotate-180 dark:invert-0 dark:hue-rotate-0 w-full max-w-[1400px] left-1/2 -translate-x-1/2 top-0'
      >
        <source src='/hero-bg.mp4' type='video/mp4' />
      </video>

      {/* Top gradient */}
      <div
        className='absolute top-0 inset-x-0 h-[100%] z-1 pointer-events-none'
        style={{ background: TOP_GRADIENT }}
      />

      {/* Bottom gradient */}
      <div
        className='absolute bottom-0 inset-x-0 h-[60%] z-1 pointer-events-none'
        style={{ background: BOTTOM_GRADIENT }}
      />

      {/* Foreground content */}
      <div className='relative pb-[300px]  z-2 flex flex-col items-center text-center max-w-[720px] w-full px-6 pb-20 gap-6'>
        <h1 className='text-[clamp(2.5rem,6vw,4.5rem)] font-bold leading-[1.05] tracking-[-0.03em] text-foreground'>
          Delightful Docs.
        </h1>

        <div className='text-[clamp(1rem,2vw,1.25rem)] leading-relaxed text-muted-foreground max-w-[520px]'>
          Mintlify drop-in replacement as a Vite plugin. Own your docs, ship with Git, build locally.
        </div>

        {/* CTAs */}
        <div className='flex gap-3 mt-2 flex-wrap justify-center'>
          <a
            href='/components'
            className='inline-flex items-center justify-center px-7 py-3 rounded-lg text-[0.95rem] font-medium bg-foreground text-background no-underline transition-transform duration-160 ease-out active:scale-[0.97]'
          >
            Get Started
          </a>
          <a
            href='https://github.com/remorses/holocron'
            target='_blank'
            rel='noopener noreferrer'
            className='inline-flex items-center justify-center px-7 py-3 rounded-lg text-[0.95rem] font-medium bg-foreground/10 text-foreground border border-foreground/20 no-underline transition-transform duration-160 ease-out active:scale-[0.97]'
          >
            GitHub
          </a>
        </div>


      </div>
    </div>
  )
}
