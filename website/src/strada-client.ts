// Browser-side Strada SDK initialization.
// Import this module as a side effect in a client component so initStrada()
// runs once when the module loads in the browser.
//
// The `browser` export condition resolves `@strada.sh/sdk` to the browser
// entry, which sets up WebTracerProvider, pageview spans, session management,
// error/rejection handlers, and W3C Baggage propagation.
//
// Also registers React 19 error handlers via spiceflow so React render errors
// (caught by ErrorBoundary, uncaught, and hydration mismatches) are sent to
// Strada as captured exceptions.

'use client'

import { initStrada, captureException } from '@strada.sh/sdk'
import { setReactErrorHandlers } from 'spiceflow/react'

initStrada({
  projectId: '01KSK35SFJD9QAM5632G2944PA',
  service: 'holocron-frontend',
})

setReactErrorHandlers({
  onCaughtError(error) {
    captureException(error, {
      tags: { reactHandler: 'onCaughtError' },
    })
  },
  onUncaughtError(error) {
    captureException(error, {
      tags: { reactHandler: 'onUncaughtError' },
    })
  },
  onRecoverableError(error) {
    captureException(error, {
      tags: { reactHandler: 'onRecoverableError' },
    })
  },
})
