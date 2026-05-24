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
  /** Background image URL rendered behind the gradient overlay */
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

const BG_IMAGES = [
  'https://cdn.midjourney.com/0497ef8a-8266-4105-81d6-a176e74c7960/0_1.png',
  'https://cdn.midjourney.com/4937e6b7-012c-4fb7-ac8b-abe255b2e5af/0_0.png',
  'https://cdn.midjourney.com/1973d3c5-fddf-489b-9d97-2b2194c52def/0_2.png',
  'https://cdn.midjourney.com/1973d3c5-fddf-489b-9d97-2b2194c52def/0_1.png',
  'https://cdn.midjourney.com/938da541-c838-415e-8d85-943f796b9c82/0_0.png',
  'https://cdn.midjourney.com/ffcccfa1-1024-49b3-95b9-606bd0821c54/0_2.png',
  'https://cdn.midjourney.com/a2b7113a-d4aa-4e0f-949e-0f5f01d3d410/0_2.png',
  'https://cdn.midjourney.com/4fcd185a-c350-436f-b9d4-75fcc3ba3672/0_0.png',
  'https://cdn.midjourney.com/b9704ad1-1b92-4017-927e-8c82ae80ac1a/0_0.png',
  'https://cdn.midjourney.com/b9704ad1-1b92-4017-927e-8c82ae80ac1a/0_2.png',
  'https://cdn.midjourney.com/8d6c592c-541d-4f79-982d-f5995f454053/0_2.png',
  'https://cdn.midjourney.com/404f0e19-5956-4752-9a8e-df991bf70c7e/0_0.png',
  'https://cdn.midjourney.com/e3c7e3a5-a8ae-41cd-9379-aad2d91298a3/0_3.png',
  'https://cdn.midjourney.com/851d6a59-5e9b-4a82-8e34-c183b5400135/0_1.png',
  'https://cdn.midjourney.com/419dc067-3555-4bb7-898f-6f2b7be503c1/0_2.png',
  'https://cdn.midjourney.com/e1c26816-4d8f-443e-9725-98b46318a534/0_0.png',
  'https://cdn.midjourney.com/32b57d29-e1a9-4cb6-a3ee-718d0910e268/0_0.png',
  'https://cdn.midjourney.com/1a2fd2f9-4c9e-471f-b18c-a2c75e2e4027/0_0.png',
  'https://cdn.midjourney.com/7636c35d-56c7-4885-906c-d02707212396/0_2.png',
  'https://cdn.midjourney.com/226c604a-38eb-4542-a437-64a49a1173fd/0_0.png',
]

function hashTitle(title: string): number {
  let hash = 0
  for (let i = 0; i < title.length; i++) {
    hash = ((hash << 5) - hash + title.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}

function OgTemplate({ iconUrl, title, description, siteName, pageLabel, backgroundUrl }: OgImageOptions) {
  const bgUrl = backgroundUrl || BG_IMAGES[hashTitle(title) % BG_IMAGES.length]
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
