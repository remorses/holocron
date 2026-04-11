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

import { getRouter, router, useLoaderData, useRouterState } from 'spiceflow/react'
import type { HolocronApp, HolocronLoaderData } from './app-factory.tsx'

export { router }
export const useHolocronRouterState = () => useRouterState<HolocronApp>()

const typed = getRouter<HolocronApp>()
export const href = typed.href

/** Typed per-request loader data. */
export const useHolocronData = () =>
	useLoaderData<HolocronApp>() as HolocronLoaderData
