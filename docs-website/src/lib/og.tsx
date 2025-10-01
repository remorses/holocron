import { Resvg } from '@resvg/resvg-js'
import React from 'react'
import satori from 'satori'
import memoize from 'micro-memoize'

const loadGoogleFont = memoize(
  async function (font: string, weight: number): Promise<ArrayBuffer> {
    const url = `https://fonts.googleapis.com/css2?family=${font}:wght@${weight}`
    const css = await fetch(url).then((res) => res.text())
    const resource = css.match(/src: url\((.+)\) format\('(opentype|truetype)'\)/)

    if (resource) {
      const response = await fetch(resource[1])
      if (response.status === 200) {
        return await response.arrayBuffer()
      }
    }

    throw new Error('Failed to load font data')
  },
  { maxSize: 10 }
)

function getExcerpt(text: string | null | undefined, maxLength: number = 125): string {
  if (!text) return ''
  return text.length > maxLength ? text.slice(0, maxLength) + '...' : text
}

const HolocronLogo = ({ style }: { style?: React.CSSProperties }) => {
  return (
    <svg
      width="456"
      height="412"
      viewBox="0 0 456 412"
      xmlns="http://www.w3.org/2000/svg"
      style={style}
    >
      <path
        fill="currentColor"
        fillRule="nonzero"
        d="M155.274432,90.7143045 C157.057137,87.6265521 160.349014,85.7215309 163.914431,85.7142857 L290.71441,85.7142857 C294.294118,85.7072408 297.604558,87.6141765 299.394409,90.7143045 L362.834398,200.714286 C364.620726,203.808297 364.620726,207.620275 362.834398,210.714286 L299.394409,320.714267 C297.604558,323.814395 294.294118,325.721331 290.71441,325.714286 L163.914431,325.714286 C160.349014,325.707041 157.057137,323.802019 155.274432,320.714267 L91.8344426,210.714286 C90.048115,207.620275 90.048115,203.808297 91.8344426,200.714286 L155.274432,90.7143045 Z M145.794421,0 C122.857278,0 101.565849,12.2914286 90.0972777,32.1942857 L8.58299197,173.622857 C-2.86099732,193.486771 -2.86099732,217.941801 8.58299197,237.805714 L90.0972777,379.234286 C101.572034,399.151604 122.808129,411.428571 145.794421,411.428571 L308.822992,411.428571 C331.811563,411.428571 353.051563,399.137143 364.520135,379.234286 L446.085849,237.805714 C457.529838,217.941801 457.529838,193.486771 446.085849,173.622857 L364.520135,32.1942857 C353.045378,12.2769674 331.809284,0 308.822992,0 L145.794421,0 Z"
      />
    </svg>
  )
}

const LogoSymbol = ({ style }: { style?: React.CSSProperties }) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 327 309"
      height="24"
      width="24"
      style={style}
    >
      <path
        fill="currentColor"
        d="M311.63,154.67 L311.63,139.84 L190.93,146.79 C186.72,147.02 183.12,143.79 182.89,139.59 C182.79,137.72 183.36,135.98 184.4,134.59 L250.52,33.92 L224.82,19.08 L170.48,127.1 C168.58,130.86 163.99,132.38 160.23,130.48 C158.69,129.7 157.53,128.48 156.82,127.05 L102.51,19.08 L76.81,33.92 L143.19,134.98 C145.5,138.5 144.52,143.22 141.01,145.54 C139.59,146.47 137.98,146.87 136.4,146.78 L136.4,146.8 L15.7,139.85 L15.7,169.51 L136.4,162.56 C140.61,162.33 144.21,165.55 144.44,169.76 C144.54,171.62 143.96,173.37 142.93,174.76 L76.81,275.43 L89.68,282.86 L89.69,282.85 L102.53,290.26 L156.86,182.25 C158.76,178.49 163.35,176.97 167.11,178.87 C168.65,179.65 169.81,180.87 170.52,182.3 L224.83,290.26 L237.66,282.85 L238.09,282.62 L250.53,275.43 L184.16,174.37 C181.85,170.85 182.83,166.13 186.34,163.82 C187.76,162.89 189.37,162.49 190.94,162.58 L190.94,162.57 L311.64,169.52 L311.64,154.69 L311.63,154.67 Z M326.94,131.75 L326.94,177.59 L326.92,177.59 L326.91,178.01 C326.68,182.22 323.08,185.44 318.87,185.21 L205.21,178.67 L267.68,273.78 L267.93,274.19 C270.02,277.84 268.77,282.5 265.12,284.6 L245.69,295.81 L245.3,296.05 L225.45,307.51 L225.06,307.72 C221.3,309.62 216.71,308.11 214.81,304.34 L163.66,202.66 L112.59,304.19 C112.5,304.37 112.41,304.55 112.31,304.73 C110.2,308.38 105.52,309.62 101.88,307.51 L82.03,296.05 L82.04,296.04 L62.21,284.6 L61.82,284.36 C58.3,282.05 57.33,277.32 59.64,273.8 L122.12,178.67 L9.03,185.18 C8.71,185.22 8.38,185.24 8.05,185.24 C3.82,185.24 0.4,181.81 0.4,177.59 L0.4,131.75 L0.42,131.75 L0.43,131.33 C0.66,127.12 4.26,123.89 8.47,124.13 L122.13,130.68 L59.66,35.57 L59.41,35.16 C57.32,31.51 58.57,26.85 62.22,24.76 L101.51,2.07 C101.75,1.91 102.01,1.76 102.28,1.63 C106.04,-0.27 110.64,1.24 112.54,5.01 L163.69,106.69 L214.84,5.01 L214.85,5.02 L215.05,4.65 C217.14,1 221.8,-0.26 225.45,1.84 L265.15,24.76 L265.54,25 C269.06,27.31 270.03,32.04 267.72,35.55 L205.24,130.68 L318.33,124.16 C318.65,124.12 318.98,124.1 319.31,124.1 C323.54,124.1 326.96,127.53 326.96,131.75 L326.94,131.75 Z"
      />
    </svg>
  )
}

type OgBaseProps = {
  faviconUrl?: string | null
  title: string
  description?: string | null
  siteName?: string
  siteTagline?: string
}

const OgBase: React.FC<OgBaseProps> = ({ 
  faviconUrl, 
  title, 
  description, 
  siteName, 
  siteTagline 
}) => {
  return (
    <div
      style={{
        height: '100%',
        width: '100%',
        display: 'flex',
        justifyContent: 'center',
        backgroundColor: '#fafafa',
        color: '#1F1F1F',
        fontFamily: 'Geist',
      }}
    >
      <HolocronLogo
        style={{
          height: '36em',
          width: '36em',
          position: 'absolute',
          top: '-25%',
          right: '-10%',
          transform: 'rotate(12deg)',
          opacity: 0.05,
        }}
      />

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          gap: '3rem',
          padding: '3.5rem 4rem',
          backgroundImage: 'linear-gradient(to bottom, transparent 60%, rgba(0, 0, 0, 0.05))',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '24' }}>
          {faviconUrl && (
            <img
              src={faviconUrl}
              alt=""
              width={92}
              height={92}
              style={{ borderRadius: '0.5rem' }}
            />
          )}

          <p style={{ fontSize: '3.4rem', fontFamily: 'GeistBold', lineHeight: '1.05' }}>
            {title}
          </p>
        </div>

        <p
          style={{
            fontSize: '2.8rem',
            lineHeight: '1.33',
            letterSpacing: '-0.015em',
            marginTop: '-1rem',
            opacity: 0.75,
          }}
        >
          {getExcerpt(description, 125)}
        </p>

        <div
          style={{
            marginTop: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            fontSize: '2rem',
          }}
        >
          {siteName && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  fontSize: '2rem',
                }}
              >
                <LogoSymbol style={{ height: '1.25em', width: '1.25em' }} />
                <span>{siteName}</span>
              </div>
              {siteTagline && (
                <span style={{ opacity: 0.5, fontSize: '1.6rem' }}>
                  {siteTagline}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export type GenerateOgImageOptions = {
  title: string
  description?: string | null
  faviconUrl?: string | null
  siteName?: string
  siteTagline?: string
}

export async function generateOgImageSvg(options: GenerateOgImageOptions): Promise<string> {
  const [geistRegular, geistBold] = await Promise.all([
    loadGoogleFont('Geist', 400),
    loadGoogleFont('Geist', 600),
  ])

  const svg = await satori(
    <OgBase {...options} />,
    {
      width: 1200,
      height: 630,
      fonts: [
        {
          name: 'Geist',
          data: geistRegular,
          weight: 400,
          style: 'normal',
        },
        {
          name: 'GeistBold',
          data: geistBold,
          weight: 600,
          style: 'normal',
        },
      ],
    }
  )

  return svg
}

export async function generateOgImagePng(options: GenerateOgImageOptions): Promise<Buffer> {
  const svg = await generateOgImageSvg(options)
  
  const resvg = new Resvg(svg, {
    fitTo: {
      mode: 'width',
      value: 1200,
    },
  })
  
  const pngData = resvg.render()
  return pngData.asPng()
}