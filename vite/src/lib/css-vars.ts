/**
 * Unified CSS custom-property (CSS variable) type for the Holocron UI.
 *
 * Every component that writes a `--my-var` inline style should type its
 * style object as `HolocronCSSProperties` (or spread a helper into it)
 * rather than reaching for ad-hoc `React.CSSProperties & { '--my-var' }`
 * intersections. This keeps the full inventory of custom properties
 * visible in one place and makes it easy to grep for consumers of a
 * given var.
 *
 * All properties are optional strings, because CSS custom properties
 * inherit and components typically only set the ones they need.
 *
 * IMPORTANT: this is NOT `Record<string, string>`. Known variable names
 * are spelled out explicitly so call sites are type-checked and adding
 * a new var requires editing this file — that's the whole point of
 * having a unified type.
 */

import type { CSSProperties } from 'react'

export interface HolocronCSSProperties extends CSSProperties {
  /* ---------------------------------------------------------------- *
   * Grid geometry — injected on `.slot-page` by editorial-page.tsx.  *
   * Source of truth: `lib/sidebar-widths.ts` (GRID_TOKENS object +   *
   * `buildGridTokenStyle` helper). `styles/globals.css` intentionally *
   * does NOT declare defaults for these vars.                         *
   * ---------------------------------------------------------------- */
  '--grid-nav-width'?: string
  '--grid-content-width'?: string
  '--grid-gap'?: string
  '--grid-sidebar-width'?: string
  '--grid-max-width'?: string

  /* ---------------------------------------------------------------- *
   * Page shell — miscellaneous per-page vars set inline on slot-page *
   * or on individual section cells.                                  *
   * ---------------------------------------------------------------- */
  /** Height of the top banner (0px when there's no banner). */
  '--banner-height'?: string
  /** `grid-row: <start> / span <N>` for a shared `<Aside full>` cell. */
  '--shared-row'?: string
}
