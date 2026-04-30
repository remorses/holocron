'use client'

/**
 * Image + video primitives with pixelated placeholders.
 * Image, LazyVideo, ChartPlaceholder.
 *
 * Image wraps its real image with `react-medium-image-zoom` so users
 * can click to zoom — the Medium-style dialog animates the image to fill the
 * viewport. The library is SSR-safe: its `hasImage()` check requires a live
 * `imgEl` ref, which is null on the server, so `document`/`window` are only
 * touched after client mount. We import the library's CSS at module load; the
 * package declares `sideEffects: ["**\/*.css"]` so bundlers keep the import.
 *
 * The rmiz wrapper (`[data-rmiz]` → `[data-rmiz-content]`) needs to fill the
 * image's grid cell so the real image still stacks over the pixelated
 * placeholder. Scoped CSS rules in `globals.css` target
 * `.holocron-pixelated-image > [data-rmiz]` to set `grid-area: 1 / 1` + full
 * width/height — we cannot reach the wrapper via inline style because rmiz
 * doesn't accept a className for the outer wrap element.
 */

import React, { useCallback, useState } from 'react'
import Zoom from 'react-medium-image-zoom'
import 'react-medium-image-zoom/dist/styles.css'

/**
 * Mintlify-compatible image with a pixelated placeholder. Uses a tiny pre-generated image with CSS
 * image-rendering: pixelated (nearest-neighbor sampling) for a crisp mosaic
 * effect. The real image fades in on top once loaded with a light blur-to-sharp
 * transition — no flash because the placeholder stays underneath and the real
 * image starts soft and transparent.
 */
export function Image({
  src,
  placeholder,
  alt,
  width,
  height,
  intrinsicWidth,
  intrinsicHeight,
  className = '',
  style,
}: {
  src: string
  /**
   * Base64 data URI of the tiny pixelated placeholder image.
   * Injected automatically by the server-side mdast image processor
   * (`vite/src/lib/image-processor.ts`) — no need to pass manually in MDX.
   * The processor reads each image at build time, generates a compact
   * placeholder with sharp, and caches it in dist/holocron-images.json.
   */
  placeholder?: string
  alt: string
  width?: number | string
  height?: number | string
  intrinsicWidth?: number | string
  intrinsicHeight?: number | string
  className?: string
  style?: React.CSSProperties
}) {
  const [loaded, setLoaded] = useState(false)
  const sourceWidth = readNumericAttr(intrinsicWidth) ?? readNumericAttr(width)
  const sourceHeight = readNumericAttr(intrinsicHeight) ?? readNumericAttr(height)
  const hasExplicitDisplaySize = intrinsicWidth !== undefined || intrinsicHeight !== undefined
  const displayWidth = hasExplicitDisplaySize ? width : undefined
  const displayHeight = hasExplicitDisplaySize ? height : undefined

  // Handles both the normal onLoad event and the case where the image is
  // already cached (img.complete is true before React mounts the handler).
  const imgRef = useCallback((img: HTMLImageElement | null) => {
    if (img?.complete && img.naturalWidth > 0) {
      setLoaded(true)
    }
  }, [])

  if (!sourceWidth || !sourceHeight) {
    return <img src={src} alt={alt} className={className} style={{ maxWidth: '100%', ...style }} />
  }

  const frameStyle = buildImageFrameStyle({
    sourceWidth,
    sourceHeight,
    displayWidth,
    displayHeight,
  })
  const imgWidth = sourceWidth
  const imgHeight = sourceHeight

  return (
    <div
      className={`holocron-pixelated-image ${className}`.trim()}
      style={{
        position: 'relative',
        overflow: 'hidden',
        ...frameStyle,
        ...style,
      }}
    >
      {/* Placeholder: tiny image rendered with nearest-neighbor sampling */}
      {placeholder && (
        <img
          src={placeholder}
          alt=''
          aria-hidden
          width={imgWidth}
          height={imgHeight}
          style={{
            gridArea: '1 / 1',
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            imageRendering: 'pixelated',
            zIndex: 0,
          }}
        />
      )}
      {/* Real image: starts soft and transparent, then sharpens in over the
          placeholder. Wrapped in <Zoom> so users can click to expand into a
          Medium-style zoomed dialog. The wrapper divs (data-rmiz,
          data-rmiz-content) inherit `grid-area: 1 / 1` + full sizing from
          globals.css so the real image still stacks over the placeholder. */}
      <Zoom>
        <img
          ref={imgRef}
          src={src}
          alt={alt}
          width={imgWidth}
          height={imgHeight}
          onLoad={() => {
            setLoaded(true)
          }}
          style={{
            display: 'block',
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            filter: !placeholder || loaded ? 'blur(0px)' : 'blur(6px)',
            opacity: !placeholder || loaded ? 1 : 0,
            transition: 'opacity 0.16s ease-out, filter 0.16s ease-out',
          }}
        />
      </Zoom>
    </div>
  )
}

function readNumericAttr(value: number | string | undefined): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  if (typeof value === 'string' && /^\d+(?:\.\d+)?$/.test(value.trim())) {
    return Number(value)
  }
  return undefined
}

function toCssLength(value: number | string | undefined): number | string | undefined {
  if (typeof value === 'number') {
    return value
  }
  if (typeof value !== 'string') {
    return undefined
  }
  const trimmed = value.trim()
  if (trimmed === '') {
    return undefined
  }
  return /^\d+(?:\.\d+)?$/.test(trimmed) ? Number(trimmed) : trimmed
}

function buildImageFrameStyle({
  sourceWidth,
  sourceHeight,
  displayWidth,
  displayHeight,
}: {
  sourceWidth: number
  sourceHeight: number
  displayWidth: number | string | undefined
  displayHeight: number | string | undefined
}): React.CSSProperties {
  const width = toCssLength(displayWidth)
  const height = toCssLength(displayHeight)
  const base: React.CSSProperties = {
    display: 'grid',
    aspectRatio: `${sourceWidth} / ${sourceHeight}`,
  }
  if (width === undefined && height === undefined) {
    return {
      ...base,
      width: '100%',
      maxWidth: `min(${sourceWidth}px, 100%)`,
    }
  }
  if (width !== undefined && height !== undefined) {
    return { ...base, width, height, maxWidth: '100%' }
  }
  if (width !== undefined) {
    return { ...base, width, maxWidth: '100%' }
  }
  return {
    ...base,
    display: 'inline-grid',
    height,
    maxWidth: '100%',
  }
}

/**
 * Lazy video with pixelated poster placeholder. Same visual pattern as
 * Image but for <video>. Poster layers (pixelated → real) show
 * through the transparent video element. Uses native loading="lazy" +
 * preload="none" so zero bytes are downloaded until the element is near
 * the viewport and the user clicks play.
 */
export function LazyVideo({
  src,
  poster,
  placeholderPoster,
  width,
  height,
  type = 'video/mp4',
  className = '',
  style,
}: {
  src: string
  poster: string
  /**
   * URL of the tiny pixelated poster placeholder. Use a static import so Vite
   * inlines it as a base64 data URI (all placeholders are < 4KB, well under
   * Vite's default assetsInlineLimit of 4096 bytes). This makes the
   * placeholder available synchronously on first render with zero HTTP
   * requests. Do NOT use dynamic imports or public/ paths — dynamic imports
   * add a microtask delay, and public/ files bypass Vite's asset pipeline.
   *
   * @example
   * ```tsx
   * import placeholderPoster from "../assets/placeholders/placeholder-demo-poster.png";
   * <LazyVideo placeholderPoster={placeholderPoster} poster="/demo-poster.png" ... />
   * ```
   */
  placeholderPoster: string
  width: number
  height: number
  type?: string
  className?: string
  style?: React.CSSProperties
}) {
  const [posterLoaded, setPosterLoaded] = useState(false)
  const videoAttrs: React.VideoHTMLAttributes<HTMLVideoElement> & { loading?: 'lazy' } = {
    controls: true,
    preload: 'none',
    loading: 'lazy',
    width,
    height,
    style: {
      position: 'relative',
      width: '100%',
      height: '100%',
      objectFit: 'cover',
      zIndex: 2,
      background: 'transparent',
    },
  }

  // Handles cached poster images (same pattern as Image)
  const posterRef = useCallback((img: HTMLImageElement | null) => {
    if (img?.complete && img.naturalWidth > 0) {
      setPosterLoaded(true)
    }
  }, [])

  return (
    <div
      className={className}
      style={{
        position: 'relative',
        width: '100%',
        maxWidth: `${width}px`,
        aspectRatio: `${width} / ${height}`,
        overflow: 'hidden',
        ...style,
      }}
    >
      {/* Pixelated poster placeholder: loads instantly (~500 bytes) */}
      <img
        src={placeholderPoster}
        alt=''
        aria-hidden
        width={width}
        height={height}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          imageRendering: 'pixelated',
          zIndex: 0,
        }}
      />
      {/* Real poster: fades in and sharpens over the pixelated placeholder */}
      <img
        ref={posterRef}
        src={poster}
        alt=''
        aria-hidden
        width={width}
        height={height}
        onLoad={() => {
          setPosterLoaded(true)
        }}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          filter: posterLoaded ? 'blur(0px)' : 'blur(6px)',
          opacity: posterLoaded ? 1 : 0,
          transition: 'opacity 0.16s ease-out, filter 0.16s ease-out',
          zIndex: 1,
        }}
      />
      {/* Video: transparent until playing, native lazy + no preload.
          Controls float on top of poster layers. No poster attr needed
          because the img layers handle the visual placeholder.
          loading="lazy" is passed through for browsers that support it. */}
      <video {...videoAttrs}>
        <source src={src} type={type} />
      </video>
    </div>
  )
}

/** Chart placeholder — dark box with animated SVG line. */
export function ChartPlaceholder({ height = 200, label }: { height?: number; label?: string }) {
  return (
    <div className='bleed'>
      <div
        className='w-full overflow-hidden relative'
        style={{
          height: `${height}px`,
          background: 'rgb(17, 17, 17)',
        }}
      >
        <svg viewBox='0 0 550 200' className='absolute inset-0 w-full h-full' preserveAspectRatio='none'>
          <defs>
            <linearGradient id='chartFill' x1='0' y1='0' x2='0' y2='1'>
              <stop offset='0%' stopColor='#3b82f6' stopOpacity='0.3' />
              <stop offset='100%' stopColor='#3b82f6' stopOpacity='0' />
            </linearGradient>
          </defs>
          <path
            d='M0,140 C30,135 60,120 90,125 C120,130 150,100 180,95 C210,90 240,110 270,105 C300,100 330,80 360,85 C390,90 420,70 450,65 C480,60 510,75 550,60'
            fill='none'
            stroke='#3b82f6'
            strokeWidth='2'
          />
          <path
            d='M0,140 C30,135 60,120 90,125 C120,130 150,100 180,95 C210,90 240,110 270,105 C300,100 330,80 360,85 C390,90 420,70 450,65 C480,60 510,75 550,60 L550,200 L0,200 Z'
            fill='url(#chartFill)'
          />
          <circle cx='550' cy='60' r='4' fill='#3b82f6'>
            <animate attributeName='r' values='4;6;4' dur='2s' repeatCount='indefinite' />
            <animate attributeName='opacity' values='1;0.6;1' dur='2s' repeatCount='indefinite' />
          </circle>
        </svg>
        {label && (
          <div
            className='absolute top-3 right-3 px-2 py-1 rounded text-xs'
            style={{
              background: 'rgba(59, 130, 246, 0.15)',
              color: '#3b82f6',
              fontFamily: 'var(--font-code)',
              fontWeight: 'var(--weight-prose)',
              fontSize: 'var(--type-table-size)',
            }}
          >
            {label}
          </div>
        )}
      </div>
    </div>
  )
}
