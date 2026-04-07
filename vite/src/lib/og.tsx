/**
 * OG image renderer backed by Takumi's ImageResponse.
 */

import React from 'react'
import { ImageResponse } from 'takumi-js/response'
export { getAbsoluteOgImageUrl, getOgPath, resolveOgIconUrl } from './og-utils.ts'

export type OgImageOptions = {
  title: string
  description?: string | null
  iconUrl?: string
  siteName?: string
  pageLabel?: string
}

function getExcerpt(text: string | null | undefined, maxLength: number = 140): string {
  if (!text) return ''
  return text.length > maxLength ? `${text.slice(0, maxLength).trimEnd()}...` : text
}

function HolocronMark({ color, width, height }: { color: string; width: number; height: number }) {
  return (
    <svg viewBox='0 0 456 412' width={width} height={height} fill='none' xmlns='http://www.w3.org/2000/svg'>
      <path
        d='M155.274 90.714c1.783-3.088 5.075-4.993 8.64-5H290.714c3.58-.007 6.891 1.9 8.68 5l63.44 110c1.787 3.094 1.787 6.906 0 10l-63.44 110c-1.789 3.1-5.1 5.007-8.68 5H163.914c-3.565-.007-6.857-1.912-8.64-5l-63.44-110c-1.786-3.094-1.786-6.906 0-10l63.44-110ZM145.794 0C122.857 0 101.566 12.291 90.097 32.194L8.583 173.623c-11.444 19.864-11.444 44.319 0 64.183l81.514 141.428c11.475 19.918 32.711 32.195 55.697 32.195h163.029c22.988 0 44.228-12.291 55.697-32.194l81.566-141.429c11.444-19.864 11.444-44.319 0-64.183L364.52 32.194C353.045 12.277 331.809 0 308.823 0H145.794Z'
        fill={color}
      />
    </svg>
  )
}

function GearSymbol({ color, width, height }: { color: string; width: number; height: number }) {
  return (
    <svg viewBox='0 0 24 24' width={width} height={height} fill='none' xmlns='http://www.w3.org/2000/svg'>
      <path
        fill={color}
        d='M19.43 12.98c.04-.32.07-.64.07-.98s-.03-.66-.07-.98l2.11-1.65c.19-.15.24-.42.12-.64l-2-3.46a.5.5 0 0 0-.61-.22l-2.49 1c-.52-.4-1.08-.73-1.69-.98l-.38-2.65A.49.49 0 0 0 14 2h-4c-.25 0-.46.18-.49.42l-.38 2.65c-.61.25-1.17.59-1.69.98l-2.49-1a.6.6 0 0 0-.18-.03c-.17 0-.34.09-.43.25l-2 3.46c-.13.22-.07.49.12.64l2.11 1.65c-.04.32-.07.65-.07.98s.03.66.07.98l-2.11 1.65c-.19.15-.24.42-.12.64l2 3.46a.5.5 0 0 0 .61.22l2.49-1c.52.4 1.08.73 1.69.98l.38 2.65c.03.24.24.42.49.42h4c.25 0 .46-.18.49-.42l.38-2.65c.61-.25 1.17-.59 1.69-.98l2.49 1q.09.03.18.03c.17 0 .34-.09.43-.25l2-3.46c.12-.22.07-.49-.12-.64zm-1.98-1.71c.04.31.05.52.05.73s-.02.43-.05.73l-.14 1.13l.89.7l1.08.84l-.7 1.21l-1.27-.51l-1.04-.42l-.9.68c-.43.32-.84.56-1.25.73l-1.06.43l-.16 1.13l-.2 1.35h-1.4l-.19-1.35l-.16-1.13l-1.06-.43c-.43-.18-.83-.41-1.23-.71l-.91-.7l-1.06.43l-1.27.51l-.7-1.21l1.08-.84l.89-.7l-.14-1.13c-.03-.31-.05-.54-.05-.74s.02-.43.05-.73l.14-1.13l-.89-.7l-1.08-.84l.7-1.21l1.27.51l1.04.42l.9-.68c.43-.32.84-.56 1.25-.73l1.06-.43l.16-1.13l.2-1.35h1.39l.19 1.35l.16 1.13l1.06.43c.43.18.83.41 1.23.71l.91.7l1.06-.43l1.27-.51l.7 1.21l-1.07.85l-.89.7zM12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4s4-1.79 4-4s-1.79-4-4-4m0 6c-1.1 0-2-.9-2-2s.9-2 2-2s2 .9 2 2s-.9 2-2 2'
      />
    </svg>
  )
}

function HolocronIcon({ size = 92 }: { size?: number }) {
  const markWidth = Math.round(size * 0.68)
  const markHeight = Math.round(markWidth * 412 / 456)

  return (
    <div
      style={{
        width: size,
        height: size,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: Math.round(size * 0.24),
        backgroundColor: '#111111',
        padding: Math.round(size * 0.16),
      }}
    >
      <HolocronMark color='#ffffff' width={markWidth} height={markHeight} />
    </div>
  )
}

function OgIcon({ iconUrl, size }: { iconUrl?: string; size: number }) {
  if (!iconUrl) return <HolocronIcon size={size} />

  return (
    <img
      src={iconUrl}
      alt=''
      width={size}
      height={size}
      style={{
        flexShrink: 0,
        borderRadius: Math.round(size * 0.24),
        objectFit: 'contain',
        backgroundColor: '#ffffff',
        border: '1px solid rgba(0, 0, 0, 0.08)',
        padding: Math.round(size * 0.11),
      }}
    />
  )
}

function OgTemplate({ iconUrl, title, description, siteName, pageLabel }: OgImageOptions) {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        justifyContent: 'center',
        overflow: 'hidden',
        backgroundColor: '#ece9e2',
        backgroundImage: 'linear-gradient(180deg, #f7f5f1 0%, #ebe7e0 48%, #e2ddd5 100%)',
        color: '#1f1f1f',
        fontFamily: 'Geist',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: '-18%',
          right: '-8%',
          transform: 'rotate(12deg)',
        }}
      >
        <GearSymbol color='#dbd7d2' width={560} height={560} />
      </div>
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          position: 'relative',
          padding: '56px 64px',
          backgroundImage: 'linear-gradient(180deg, rgba(255,255,255,0.42) 0%, rgba(255,255,255,0.08) 38%, rgba(0,0,0,0.07) 100%)',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'stretch',
            gap: 34,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 24,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 24,
                maxWidth: 760,
              }}
            >
              <OgIcon iconUrl={iconUrl} size={92} />
              <div
                style={{
                  fontSize: 72,
                  lineHeight: 1.02,
                  fontWeight: 700,
                  letterSpacing: '-0.04em',
                  textWrap: 'balance',
                }}
              >
                {title}
              </div>
            </div>
          </div>
          {!!description && (
            <div
              style={{
                fontSize: 45,
                lineHeight: 1.62,
                color: '#1f1f1f',
                opacity: 0.75,
                maxWidth: 860,
              }}
            >
              {getExcerpt(description, 180)}
            </div>
          )}
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 24,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              color: '#1f1f1f',
              fontSize: 28,
            }}
          >
            <div style={{ fontWeight: 600 }}>
              {siteName || 'Documentation'}
            </div>
          </div>
          <div
            style={{
              color: '#6b7280',
              fontSize: 24,
              fontWeight: 600,
              maxWidth: 420,
              lineHeight: 1.2,
              textAlign: 'right',
            }}
          >
            {pageLabel || '/'}
          </div>
        </div>
      </div>
    </div>
  )
}

export function createOgImageResponse(options: OgImageOptions): ImageResponse {
  return new ImageResponse(<OgTemplate {...options} />, {
    width: 1200,
    height: 630,
    format: 'png',
    loadDefaultFonts: true,
  })
}
