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

/** Typed per-request loader data. Throws if called outside a holocron app. */
export const useHolocronData = () =>
	useLoaderData() as HolocronLoaderData

/** Safe variant that returns undefined instead of throwing when called
 * outside a holocron app (e.g. chat response components rendered via
 * RSC federation in a standalone widget consumer). */
export function useHolocronDataSafe(): HolocronLoaderData | undefined {
	try {
		return useLoaderData() as HolocronLoaderData
	} catch (error) {
		// Only swallow the known missing-context error from standalone widget
		// rendering. Rethrow everything else (thenables from React.use,
		// real route errors, etc.) so Suspense and error boundaries still work.
		if (
			error instanceof Error &&
			error.message.includes('FlightDataContext is missing')
		) {
			return undefined
		}
		throw error
	}
}
