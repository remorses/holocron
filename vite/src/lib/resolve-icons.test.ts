/**
 * Icon resolver tests for canonical icon ref strings.
 */

import { describe, expect, test } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { parseLocalSvgIcon, resolveIconSvgs } from './resolve-icons.ts'

describe('resolveIconSvgs', () => {
  test('resolves canonical lucide and fontawesome refs', () => {
    const result = resolveIconSvgs([
      'lucide:github',
      'fontawesome:brands:discord',
    ])

    expect(result.atlas.icons['lucide:github']).toBeDefined()
    expect(result.atlas.icons['fontawesome:brands:discord']).toBeDefined()
    expect(result.unresolvedCount).toBe(0)
    expect(result.unresolvedRefs).toEqual([])
  })

  test('reports unresolved icon refs', () => {
    const result = resolveIconSvgs([
      'lucide:github',
      'lucide:nonexistent-icon-xyz',
      'fontawesome:brands:nonexistent-icon-abc',
      'invalid-ref',
    ])

    expect(result.atlas.icons['lucide:github']).toBeDefined()
    expect(result.unresolvedCount).toBe(3)
    expect(result.unresolvedRefs).toEqual([
      'lucide:nonexistent-icon-xyz',
      'fontawesome:brands:nonexistent-icon-abc',
      'invalid-ref',
    ])
  })

  test('inlines a local SVG file and rewrites fills to currentColor', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'holocron-icon-'))
    fs.mkdirSync(path.join(dir, 'icons'))
    fs.writeFileSync(path.join(dir, 'icons', 'mark.svg'), `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
  <path fill="#000" d="M12 3L22 21H2L12 3z"/>
</svg>
`)
    const result = resolveIconSvgs(['/icons/mark.svg'], [dir])
    expect(result.unresolvedCount).toBe(0)
    expect(result.atlas.icons['/icons/mark.svg']).toEqual({
      width: 24,
      height: 24,
      body: '<path fill="currentColor" d="M12 3L22 21H2L12 3z"/>',
    })
    fs.rmSync(dir, { recursive: true, force: true })
  })

  test('resolves a relative SVG from the project root', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'holocron-icon-rel-'))
    fs.mkdirSync(path.join(dir, 'icons'))
    fs.writeFileSync(path.join(dir, 'icons', 'mark.svg'), '<svg viewBox="0 0 24 24"><path fill="#000" d="M2 2h20v20H2z"/></svg>')
    const result = resolveIconSvgs(['./icons/mark.svg'], [dir])
    expect(result.unresolvedCount).toBe(0)
    expect(result.atlas.icons['./icons/mark.svg']?.body).toContain('currentColor')
    fs.rmSync(dir, { recursive: true, force: true })
  })

  test('rejects a path that escapes the icon dir', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'holocron-icon-esc-'))
    const result = resolveIconSvgs(['/icons/../package.json', '../icons/linear.svg'], [dir])
    expect(result.unresolvedRefs).toEqual(['/icons/../package.json', '../icons/linear.svg'])
    fs.rmSync(dir, { recursive: true, force: true })
  })
})

describe('parseLocalSvgIcon', () => {
  test('reads viewBox and inner markup', () => {
    expect(parseLocalSvgIcon('<svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="7" fill="black"/></svg>')).toEqual({
      width: 16,
      height: 16,
      body: '<circle cx="8" cy="8" r="7" fill="currentColor"/>',
    })
  })

  test('rewrites single-quoted fills and keeps non-zero viewBox origins', () => {
    expect(parseLocalSvgIcon('<svg viewBox="-10 -10 20 20"><path fill=\'#000\' d="M0 0h20v20H0z"/></svg>')).toEqual({
      left: -10,
      top: -10,
      width: 20,
      height: 20,
      body: '<path fill="currentColor" d="M0 0h20v20H0z"/>',
    })
  })

  test('preserves root fill on a wrapping group', () => {
    expect(parseLocalSvgIcon('<svg viewBox="0 0 24 24" fill="#000"><path d="M0 0h24v24z"/></svg>')).toEqual({
      width: 24,
      height: 24,
      body: '<g fill="currentColor"><path d="M0 0h24v24z"/></g>',
    })
  })

  test('rejects SVGs with event handlers or script tags', () => {
    expect(parseLocalSvgIcon('<svg viewBox="0 0 24 24"><g onload="globalThis.pwned=1"><path d="M0 0"/></g></svg>')).toBeNull()
    expect(parseLocalSvgIcon('<svg viewBox="0 0 24 24"><image href="x" onerror="alert(1)"/></svg>')).toBeNull()
    expect(parseLocalSvgIcon('<svg viewBox="0 0 24 24"><script>alert(1)</script></svg>')).toBeNull()
  })
})
