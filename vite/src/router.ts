'use client'

/**
 * Holocron typed client router.
 *
 * Single `createRouter<HolocronApp>()` binding so every client component gets
 * type-safe access to loader data, the router, and `href()` without repeatedly
 * importing the app type.
 *
 * Usage in a client component:
 *
 *   import { useHolocronData, href } from '@holocron.so/vite/react'
 *
 *   function Breadcrumb() {
 *     const { currentPageHref } = useHolocronData()
 *     ...
 *   }
 */

import { createRouter, router, useRouterState } from 'spiceflow/react'
import type { HolocronApp, HolocronLoaderData } from './app-factory.tsx'

// `router` and `useRouterState` are re-exported directly from `spiceflow/react`
// (they are the same singleton `createRouter` returns). This avoids a
// TS2742 declaration-file portability error on the destructured `router`
// binding, whose inferred type references `import("history").To` via a
// pnpm-mangled path. Only the App-typed hooks need to come from
// `createRouter<HolocronApp>()`.
export { router, useRouterState }

const typed = createRouter<HolocronApp>()
export const useLoaderData = typed.useLoaderData
export const getLoaderData = typed.getLoaderData
export const href = typed.href

/**
 * Convenience hook so callers never need to remember the `/*` pattern.
 * Returns the full per-request loader data produced by `.loader('/*')` in
 * app-factory.tsx.
 */
export const useHolocronData = () => useLoaderData('/*') as HolocronLoaderData
