/**
 * Async RSC component — tests that the video framework handles async
 * server components rendered through SafeMdxRenderer → RSC flight.
 * No 'use client' directive, so this runs on the server.
 */

export async function AsyncStats() {
  // Simulate async data fetch
  await new Promise((resolve) => setTimeout(resolve, 500))

  const stats = [
    { label: 'Pages Built', value: '12,847' },
    { label: 'Avg Build Time', value: '1.2s' },
    { label: 'Uptime', value: '99.99%' },
  ]

  return (
    <div
      style={{
        display: 'flex',
        gap: 48,
        padding: '24px 80px 0',
      }}
    >
      {stats.map((s) => (
        <div
          key={s.label}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <span
            style={{
              fontSize: 48,
              fontWeight: 700,
              color: '#fafafa',
              fontFamily:
                '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
              letterSpacing: '-0.03em',
            }}
          >
            {s.value}
          </span>
          <span
            style={{
              fontSize: 16,
              color: '#71717a',
              fontFamily:
                '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
            }}
          >
            {s.label}
          </span>
        </div>
      ))}
    </div>
  )
}
