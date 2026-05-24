/**
 * OG image renderer backed by Takumi's ImageResponse.
 *
 * Runs inside the og-worker Cloudflare Worker, separate from the main
 * holocron website worker to keep the takumi WASM (~5 MiB) out of the
 * main worker's 10 MiB bundle limit.
 */

import React from 'react'
import { ImageResponse } from 'takumi-js/response'

export type OgImageOptions = {
  title: string
  description?: string | null
  iconUrl?: string
  siteName?: string
  pageLabel?: string
  /** Background image URL or data URI rendered behind the gradient overlay */
  backgroundUrl?: string
}

function getExcerpt(text: string | null | undefined, maxLength: number = 140): string {
  if (!text) return ''
  return text.length > maxLength ? `${text.slice(0, maxLength).trimEnd()}...` : text
}

function OgIcon({ iconUrl, size }: { iconUrl?: string; size: number }) {
  if (!iconUrl) return null

  return (
    <img
      src={iconUrl}
      alt=''
      width={size}
      height={size}
      style={{
        flexShrink: 0,
        borderRadius: Math.round(size * 0.16),
        objectFit: 'cover',
      }}
    />
  )
}

/** Total number of background images in public/bg/ (0.jpg through 20.jpg) */
export const BG_IMAGE_COUNT = 21

export function hashTitle(title: string): number {
  let hash = 0
  for (let i = 0; i < title.length; i++) {
    hash = ((hash << 5) - hash + title.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}

function OgTemplate({ iconUrl, title, description, siteName, pageLabel, backgroundUrl }: OgImageOptions) {
  const bgUrl = backgroundUrl || ''
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        overflow: 'hidden',
        backgroundColor: '#f5f5f5',
        color: '#1a1a1a',
        fontFamily: 'Geist',
      }}
    >
      <img
        src={bgUrl}
        alt=''
        width={1200}
        height={630}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          filter: 'saturate(0.5)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundImage: 'linear-gradient(180deg, rgba(255,255,255,0.75) 0%, rgba(255,255,255,0.75) 40%, rgba(255,255,255,0.30) 100%)',
        }}
      />
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          position: 'relative',
          padding: '64px 72px',
          width: '100%',
          height: '100%',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 24,
            }}
          >
            <OgIcon iconUrl={iconUrl} size={88} />
            <div
              style={{
                fontSize: 76,
                lineHeight: 1,
                fontWeight: 700,
                letterSpacing: '-0.02em',
                maxWidth: 800,
              }}
            >
              {title}
            </div>
          </div>
          {!!description && (
            <div
              style={{
                fontSize: 42,
                lineHeight: 1.4,
                color: '#666666',
                maxWidth: 900,
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
              fontSize: 30,
              fontWeight: 600,
              color: '#1a1a1a',
            }}
          >
            {siteName || 'Documentation'}
          </div>
          <div
            style={{
            color: '#1a1a1a',
            fontSize: 24,
            fontWeight: 500,
              maxWidth: 460,
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
