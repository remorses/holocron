'use client'

/**
 * GitHub star count badge for navbar/footer links.
 *
 * Receives a Promise<Record<string, number>> from the RSC loader via
 * HolocronLoaderData.githubStars. Uses React.use() inside a Suspense
 * boundary so the star count streams in without blocking the initial
 * page render.
 */

import React, { Suspense, use } from 'react'
import { formatStarCount, getGitHubRepoKey } from '../../lib/github-stars.ts'

function StarCount({ starsPromise, href }: { starsPromise: Promise<Record<string, number>>; href: string }) {
  const starsMap = use(starsPromise)
  const key = getGitHubRepoKey(href)
  const count = key ? starsMap[key] : undefined
  if (count === undefined) return null
  return (
    <span className='inline-flex items-center gap-0.5 text-xs tabular-nums text-inherit transition-colors duration-150'>
      {formatStarCount(count)} stars
    </span>
  )
}

export function GitHubStars({ starsPromise, href }: { starsPromise: Promise<Record<string, number>>; href: string }) {
  return (
    <Suspense fallback={null}>
      <StarCount starsPromise={starsPromise} href={href} />
    </Suspense>
  )
}
