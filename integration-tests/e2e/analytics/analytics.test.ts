/**
 * Analytics integration fixture: verifies that configured analytics provider
 * scripts are injected into the page HTML.
 */

import { expect, test } from '../helpers/test.ts'

test.describe('analytics integrations', () => {
  test('Fathom script tag is present with correct siteId', async ({ request }) => {
    const res = await request.get('/')
    const html = await res.text()
    expect(html).toContain('cdn.usefathom.com/script.js')
    expect(html).toContain('FATHOM_TEST')
  })

  test('GA4 gtag.js loader and config are present', async ({ request }) => {
    const res = await request.get('/')
    const html = await res.text()
    expect(html).toContain('googletagmanager.com/gtag/js?id=G-TEST12345')
    expect(html).toContain('G-TEST12345')
    expect(html).toContain('gtag')
  })

  test('GTM inline script is present', async ({ request }) => {
    const res = await request.get('/')
    const html = await res.text()
    expect(html).toContain('GTM-TEST')
    expect(html).toContain('gtm.js')
  })

  test('GTM noscript iframe is present in body', async ({ request }) => {
    const res = await request.get('/')
    const html = await res.text()
    expect(html).toContain('googletagmanager.com/ns.html?id=GTM-TEST')
    expect(html).toContain('<noscript>')
  })

  test('Plausible script tag is present with data-domain', async ({ request }) => {
    const res = await request.get('/')
    const html = await res.text()
    expect(html).toContain('plausible.io/js/script.js')
    expect(html).toContain('test.example.com')
  })

  test('Clarity script is present with projectId', async ({ request }) => {
    const res = await request.get('/')
    const html = await res.text()
    expect(html).toContain('clarity.ms')
    expect(html).toContain('clarity_test')
  })

  test('Pirsch script tag is present with data-code', async ({ request }) => {
    const res = await request.get('/')
    const html = await res.text()
    expect(html).toContain('api.pirsch.io/pa.js')
    expect(html).toContain('pirsch_test')
  })
})
