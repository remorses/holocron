// Email template for first-deploy notifications.
// Sent once when a project's first production deployment finalizes via GitHub OIDC.
// Intentionally styled like a manually written email: no headings, no cards,
// no branding chrome — just Gmail-default text with links, bold, a list, and
// minimal inline-code styling. Dark mode supported via prefers-color-scheme.
//
// Plain template strings instead of JSX on purpose: spiceflow/federation's
// renderToStaticMarkup only works inside the Vite RSC runtime, which made the
// template impossible to render from node scripts or plain workers. Strings
// work everywhere.

import dedent from 'string-dedent'

export interface DeployEmailData {
  githubOwner: string
  githubRepo: string
  url: string
  branch: string
}

const DOCS_BASE = 'https://holocron.so/docs'

function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

// Inline code with minimal styling: gray-alpha background works in both
// light and dark mode without a media query.
function code(text: string): string {
  return `<code style="font-family: monospace; font-size: 0.9em; background-color: rgba(128, 128, 128, 0.15); padding: 1px 4px; border-radius: 3px;">${escapeHtml(text)}</code>`
}

function link(href: string, text: string): string {
  return `<a href="${escapeHtml(href)}">${escapeHtml(text)}</a>`
}

export function buildDeployEmailSubject(data: DeployEmailData): string {
  return `Your docs for ${data.githubOwner}/${data.githubRepo} are live`
}

export async function buildDeployEmailHtml(data: DeployEmailData): Promise<string> {
  const repo = escapeHtml(`${data.githubOwner}/${data.githubRepo}`)
  const url = escapeHtml(data.url)

  const HTML = dedent`
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="color-scheme" content="light dark" />
        <meta name="supported-color-schemes" content="light dark" />
        <style>
          body { background-color: #ffffff; }
          a { color: #15c; }
          @media (prefers-color-scheme: dark) {
            body { background-color: #1f1f1f !important; color: #e3e3e3 !important; }
            a { color: #8ab4f8 !important; }
          }
        </style>
      </head>
      <body style="font-family: Arial, Helvetica, sans-serif; font-size: 14px; line-height: 1.5; color: #222; margin: 0; padding: 16px; -webkit-text-size-adjust: 100%;">
        <div style="max-width: 600px;">
          <p>Hey,</p>

          <p>your docs site for <strong>${repo}</strong> just went live:</p>

          <p><a href="${url}">${url}</a></p>

          <p>Every push to the ${code(data.branch)} branch deploys automatically.</p>

          <p>A few things you might want to set up next:</p>

          <ul style="margin: 0 0 16px 0; padding-left: 24px;">
            <li>${link(`${DOCS_BASE}/deploy/holocron`, 'custom domain')} for production</li>
            <li>your ${link(`${DOCS_BASE}/customize/logo-and-favicon`, 'logo')} and ${link(`${DOCS_BASE}/customize/theme`, 'colors')}</li>
            <li>the ${link(`${DOCS_BASE}/ai/assistant`, 'AI assistant')} widget so readers can ask questions about your docs</li>
          </ul>

          <p>If anything looks off, just reply to this email and I'll take a look.</p>

          <p>Tommy<br /><a href="https://holocron.so">holocron.so</a></p>
        </div>
      </body>
    </html>
  `
  return HTML
}
