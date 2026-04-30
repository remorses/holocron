'use client'

/**
 * Holocron typed client router.
 *
 * Binds the Spiceflow router and loader hooks to the Holocron app type so
 * components can read typed loader data without repeatedly importing `App`.
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

import { router, useLoaderData } from 'spiceflow/react'
import type { HolocronLoaderData } from './app-factory.tsx'

export { router }

export const href = router.href

/** Typed per-request loader data. */
export const useHolocronData = () =>
	useLoaderData() as HolocronLoaderData
