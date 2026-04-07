'use client'

/**
 * Holocron typed client router.
 *
 * Single `createRouter<HolocronApp>()` binding so every client component gets
 * type-safe access to loader data, the router, and `href()` without repeatedly
 * importing the app type.
 */

import { createRouter, router, useRouterState } from 'spiceflow/react'
import type { HolocronApp, HolocronLoaderData } from './app-factory.tsx'

export { router, useRouterState }

const typed = createRouter<HolocronApp>()
export const useLoaderData = typed.useLoaderData
export const getLoaderData = typed.getLoaderData
export const href = typed.href

export const useHolocronData = () => useLoaderData('/*') as HolocronLoaderData
