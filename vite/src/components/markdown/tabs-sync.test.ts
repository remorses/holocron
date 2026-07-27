import { afterEach, describe, expect, test } from 'vitest'
import {
  getServerSyncedTabTitle,
  getSyncedTabTitle,
  resetTabSyncForTests,
  resolveSyncedTabIndex,
  setSyncedTabTitle,
  subscribeSyncedTabTitle,
} from './tabs.tsx'

describe('resolveSyncedTabIndex', () => {
  test('falls back when no synced title', () => {
    expect(resolveSyncedTabIndex(['cURL', 'TypeScript'], null, 0)).toBe(0)
    expect(resolveSyncedTabIndex(['cURL', 'TypeScript'], null, 1)).toBe(1)
  })

  test('exact title match', () => {
    expect(resolveSyncedTabIndex(['cURL', 'TypeScript', 'Python'], 'TypeScript', 0)).toBe(1)
  })

  test('case-insensitive match', () => {
    expect(resolveSyncedTabIndex(['cURL', 'TypeScript'], 'typescript', 0)).toBe(1)
  })

  test('unknown title keeps fallback', () => {
    expect(resolveSyncedTabIndex(['cURL', 'Python'], 'TypeScript', 0)).toBe(0)
  })
})

describe('tab sync store', () => {
  afterEach(() => {
    resetTabSyncForTests()
  })

  test('server snapshot is always null', () => {
    expect(getServerSyncedTabTitle()).toBe(null)
  })

  test('setSyncedTabTitle notifies subscribers', () => {
    let ticks = 0
    const unsub = subscribeSyncedTabTitle(() => {
      ticks += 1
    })
    setSyncedTabTitle('TypeScript')
    expect(getSyncedTabTitle()).toBe('TypeScript')
    expect(ticks).toBeGreaterThanOrEqual(1)
    const before = ticks
    setSyncedTabTitle('TypeScript')
    expect(ticks).toBe(before)
    unsub()
  })
})
