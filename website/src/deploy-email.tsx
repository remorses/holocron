// Email template for first-deploy notifications.
// Sent once when a project's first production deployment finalizes via GitHub OIDC.
// Uses React JSX rendered to static HTML with inline styles for reliable
// rendering across Gmail, Outlook, Apple Mail.

import { renderToStaticMarkup } from 'spiceflow/federation'

export interface DeployEmailData {
  githubOwner: string
  githubRepo: string
  url: string
  branch: string
}

const mono = "Consolas, 'Courier New', Monaco, Menlo, monospace"
const sans = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"

const DOCS_BASE = 'https://holocron.so'

const darkModeStyles = `
  @media (prefers-color-scheme: dark) {
    .hc-body { background-color: #1a1a1a !important; color: #e0e0e0 !important; }
    .hc-card { background-color: #252525 !important; border-color: #333 !important; }
    .hc-url { background-color: #1e293b !important; }
    .hc-url a { color: #60a5fa !important; }
    .hc-link { color: #60a5fa !important; }
    .hc-hr { border-top-color: #444 !important; }
    .hc-muted { color: #999 !important; }
  }
`

function Hr() {
  return <hr className="hc-hr" style={{ border: 'none', borderTop: '1px solid #e5e7eb', margin: '28px 0' }} />
}

function Link({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a className="hc-link" href={href} style={{ color: '#2563eb', textDecoration: 'none' }}>
      {children}
    </a>
  )
}

function EmailShell({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="color-scheme" content="light dark" />
        <meta name="supported-color-schemes" content="light dark" />
        <style dangerouslySetInnerHTML={{ __html: darkModeStyles }} />
      </head>
      <body className="hc-body" style={{
        fontFamily: sans,
        lineHeight: 1.6,
        maxWidth: 560,
        margin: '0 auto',
        padding: '40px 24px',
        WebkitTextSizeAdjust: '100%',
        color: '#1a1a1a',
      }}>
        {children}
      </body>
    </html>
  )
}

function DeployEmail({ data }: { data: DeployEmailData }) {
  const repo = `${data.githubOwner}/${data.githubRepo}`

  return (
    <EmailShell>
      <div style={{ fontSize: 14 }}>
        <div style={{ marginBottom: 32 }}>
          <strong style={{ fontSize: 20 }}>Holocron</strong>
        </div>

        <h1 style={{ fontSize: 22, fontWeight: 600, margin: '0 0 12px 0', lineHeight: 1.3 }}>
          Your docs site is live
        </h1>

        <p style={{ margin: '0 0 20px 0', fontSize: 15 }}>
          <strong>{repo}</strong> deployed successfully from the <code style={{ fontFamily: mono, fontSize: 13 }}>{data.branch}</code> branch.
        </p>

        <div className="hc-url" style={{
          backgroundColor: '#f0f4ff',
          borderRadius: 8,
          padding: '14px 18px',
          margin: '0 0 28px 0',
        }}>
          <a href={data.url} style={{
            color: '#2563eb',
            textDecoration: 'none',
            fontFamily: mono,
            fontSize: 14,
            wordBreak: 'break-all' as 'break-all',
          }}>
            {data.url}
          </a>
        </div>

        <Hr />

        <h2 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 12px 0' }}>What to do next</h2>

        <ul style={{ margin: '0 0 4px 0', paddingLeft: 20, lineHeight: 1.9 }}>
          <li>Visit <Link href={data.url}>your site</Link> and make sure everything looks right</li>
          <li>Share the URL with your team</li>
          <li>Set up a <Link href={`${DOCS_BASE}/deploy/holocron`}>custom domain</Link> for production</li>
        </ul>

        <Hr />

        <h2 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 12px 0' }}>Customize your site</h2>

        <ul style={{ margin: '0 0 4px 0', paddingLeft: 20, lineHeight: 1.9 }}>
          <li><Link href={`${DOCS_BASE}/customize/theme`}>Theming</Link> — colors, dark mode, fonts</li>
          <li><Link href={`${DOCS_BASE}/customize/logo-and-favicon`}>Logo and favicon</Link> — add your brand</li>
          <li><Link href={`${DOCS_BASE}/organize/navigation`}>Navigation</Link> — tabs, groups, versions</li>
          <li><Link href={`${DOCS_BASE}/ai/assistant`}>AI assistant</Link> — add a chat widget to your docs</li>
          <li><Link href={`${DOCS_BASE}/customize/custom-css`}>Custom CSS</Link> — full control over styles</li>
        </ul>

        <Hr />

        <p className="hc-muted" style={{ fontSize: 12, color: '#6b7280', margin: '0' }}>
          Holocron · <Link href={DOCS_BASE}>holocron.so</Link>
        </p>
      </div>
    </EmailShell>
  )
}

// ── Public API ─────────────────────────────────────────────────

export function buildDeployEmailSubject(data: DeployEmailData): string {
  return `Your docs site is live — ${data.githubOwner}/${data.githubRepo}`
}

export async function buildDeployEmailHtml(data: DeployEmailData): Promise<string> {
  return '<!DOCTYPE html>' + await renderToStaticMarkup(<DeployEmail data={data} />)
}
