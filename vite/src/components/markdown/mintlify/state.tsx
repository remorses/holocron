'use client'

import React, { createContext, useContext, useState } from 'react'

type MintlifyStateValue = {
  tabs: Record<string, string>
  setTab: (group: string, value: string) => void
  activeView: string | null
  setActiveView: (value: string | null) => void
}

const MintlifyStateContext = createContext<MintlifyStateValue | null>(null)

export function MintlifyStateProvider({ children }: { children: React.ReactNode }) {
  const [tabs, setTabs] = useState<Record<string, string>>({})
  const [activeView, setActiveView] = useState<string | null>(null)

  return (
    <MintlifyStateContext.Provider
      value={{
        tabs,
        setTab(group, value) {
          setTabs((current) => {
            if (current[group] === value) return current
            return { ...current, [group]: value }
          })
        },
        activeView,
        setActiveView,
      }}
    >
      {children}
    </MintlifyStateContext.Provider>
  )
}

export function useMintlifyState() {
  return useContext(MintlifyStateContext)
}
