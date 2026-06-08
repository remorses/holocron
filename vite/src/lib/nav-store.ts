/**
 * Navigation drawer store — vanilla zustand state for mobile nav drawer.
 * Decoupled from chatStore so the chat widget can be extracted independently.
 */

import { createStore } from 'zustand'

export type NavState = {
  navDrawerOpen: boolean
}

export const navStore = createStore<NavState>(() => ({
  navDrawerOpen: false,
}))
