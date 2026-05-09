export default function Home() {
  return (
    <main
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        gap: '1.5rem',
      }}
    >
      <h1 style={{ fontSize: '2rem', fontWeight: 700 }}>Next.js + Holocron</h1>
      <p style={{ color: '#666', maxWidth: '28rem', textAlign: 'center' }}>
        This Next.js app mounts a Holocron docs site at{' '}
        <code style={{ background: '#f0f0f0', padding: '2px 6px', borderRadius: 4 }}>
          /docs
        </code>
        . The Holocron app is built separately and served via a catch-all route handler.
      </p>
      <a
        href='/docs'
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.625rem 1.25rem',
          background: '#171717',
          color: '#fafafa',
          borderRadius: '0.5rem',
          textDecoration: 'none',
          fontSize: '0.875rem',
          fontWeight: 500,
        }}
      >
        Go to Docs →
      </a>
    </main>
  )
}
