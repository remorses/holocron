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
        d='M10.825 22q-.275 0-.488-.175t-.262-.45l-.325-2.512q-.375-.15-.725-.362t-.675-.488L5.975 19q-.25.15-.537.112t-.438-.287l-1.55-2.675q-.15-.25-.112-.537t.287-.438l2.025-1.525Q5.625 13.475 5.613 13.238Q5.6 13 5.6 12.75q0-.25.013-.488.012-.237.087-.462L3.675 10.25q-.25-.15-.288-.437-.037-.288.113-.538l1.55-2.675q.15-.25.437-.288.288-.037.538.113l2.375 1.075q.325-.275.675-.488.35-.212.725-.362l.325-2.5q.05-.275.263-.45.212-.175.487-.175h3.35q.275 0 .488.175t.262.45l.325 2.5q.375.15.725.362.35.213.675.488l2.375-1.075q.25-.15.538-.113.287.038.437.288l1.55 2.675q.15.25.113.538-.038.287-.288.437L18.95 11.8q.075.225.088.462.012.238.012.488 0 .25-.012.488-.013.237-.088.462l2.025 1.525q.25.15.288.438.037.287-.113.537l-1.55 2.675q-.15.25-.437.287-.288.038-.538-.112l-2.375-1.075q-.325.275-.675.488-.35.212-.725.362l-.325 2.512q-.05.275-.262.45t-.488.175Zm1.675-6.5q1.45 0 2.475-1.025Q16 13.45 16 12q0-1.45-1.025-2.475Q13.95 8.5 12.5 8.5q-1.45 0-2.475 1.025Q9 10.55 9 12q0 1.45 1.025 2.475Q11.05 15.5 12.5 15.5Z'
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
          top: '-30%',
          right: '-14%',
          transform: 'rotate(12deg)',
        }}
      >
        <GearSymbol color='#9a938b' width={560} height={560} />
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
                fontSize: 31,
                lineHeight: 1.55,
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
