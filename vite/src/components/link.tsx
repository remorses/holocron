'use client'

/**
 * Holocron Link wrapper around spiceflow's Link.
 *
 * Spiceflow's built-in `withBase` has a `hasBasePrefix` check that
 * gives false positives when the base path collides with a page slug
 * prefix (e.g. base `/docs` + slug `docs/quickstart` → href
 * `/docs/quickstart` looks like the base is already applied, but the
 * actual route is `/docs/docs/quickstart`).
 *
 * This wrapper bypasses that detection by using `rawHref` and
 * prepending the base path ourselves, which is always correct.
 */

import React from 'react'
import { Link as SpiceflowLink, type LinkProps as SpiceflowLinkProps } from 'spiceflow/react'

function getBase(): string {
  try {
    const raw = import.meta.env.BASE_URL
    if (!raw || raw === '/') return ''
    return raw.replace(/\/$/, '')
  } catch {
    return ''
  }
}

function withBase(href: string | undefined): string | undefined {
  if (!href) return href
  const base = getBase()
  if (!base) return href
  // Only prefix root-relative paths, not external or protocol-relative
  if (!href.startsWith('/') || href.startsWith('//')) return href
  return base + href
}

export type LinkProps = SpiceflowLinkProps & { rawHref?: boolean }

export function Link({ href, rawHref, ...rest }: LinkProps) {
  const resolved = rawHref ? href : withBase(href)
  return <SpiceflowLink {...rest} href={resolved} rawHref />
}
