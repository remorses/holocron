'use client'

/**
 * User-defined React components for the video.
 * Only exports components (no data) so React Fast Refresh works.
 * Data constants live in data.ts.
 */

import { FeaturePill } from 'holocron-video/src/components'
import type { FEATURES } from './data'

export function FeatureGrid({ features }: { features: typeof FEATURES }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, auto)',
        gap: 20,
        padding: '24px 80px 0',
      }}
    >
      {features.map((f, i) => (
        <FeaturePill key={f.label} label={f.label} icon={f.icon} index={i} />
      ))}
    </div>
  )
}
