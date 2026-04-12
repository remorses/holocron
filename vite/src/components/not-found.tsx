/**
 * 404 page body — rendered inside EditorialPage's `children` slot when a
 * requested path does not match any page in the navigation.
 *
 * Uses inline styles with existing design tokens (`--foreground`,
 * `--muted-foreground`, `--font-code`, etc.) so it stays visually consistent
 * with the rest of the editorial UI without adding new CSS.
 *
 * Never renders `<p>` tags — uses `<div>`s only. See AGENTS.md
 * "HTML element nesting rules".
 */

import React from 'react'
import { Link } from 'spiceflow/react'

export function NotFound({
  path,
  homeHref = '/',
  homeLabel = 'Back to documentation',
}: {
  /** The missing URL path, shown in monospace. Expected to start with a slash. */
  path: string
  /** Link target for the "back" action. Defaults to '/'. */
  homeHref?: string
  /** Label for the "back" action link. */
  homeLabel?: string
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        gap: '20px',
        minHeight: '60vh',
        paddingTop: '48px',
        paddingBottom: '80px',
      }}
    >
      <div
        style={{
          fontFamily: 'var(--font-code)',
          fontSize: '120px',
          lineHeight: 1,
          letterSpacing: '-0.04em',
          color: 'var(--foreground)',
          fontWeight: 'var(--weight-regular)',
        }}
      >
        404
      </div>
      <div
        style={{
          fontSize: 'var(--type-heading-1-size)',
          fontWeight: 'var(--weight-heading)',
          fontFamily: 'var(--font-primary)',
          color: 'var(--foreground)',
          letterSpacing: '-0.01em',
        }}
      >
        Page not found
      </div>
      <div
        style={{
          color: 'var(--muted-foreground)',
          fontSize: 'var(--type-body-size)',
          fontFamily: 'var(--font-primary)',
          lineHeight: 'var(--lh-prose)',
          maxWidth: '420px',
        }}
      >
        <span>The page </span>
        <code
          style={{
            fontFamily: 'var(--font-code)',
            fontSize: 'var(--type-code-size)',
            color: 'var(--foreground)',
            background: 'var(--accent)',
            padding: '2px 6px',
            borderRadius: '4px',
            wordBreak: 'break-all',
          }}
        >
          {path}
        </code>
        <span> doesn't exist or was moved.</span>
      </div>
      <Link
        href={homeHref}
        style={{
          color: 'var(--foreground)',
          textDecoration: 'none',
          fontSize: 'var(--type-body-size)',
          fontFamily: 'var(--font-primary)',
          borderBottom: '1px solid var(--foreground)',
          paddingBottom: '2px',
          marginTop: '8px',
        }}
      >
        → {homeLabel}
      </Link>
    </div>
  )
}
