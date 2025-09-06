import React, { Fragment } from 'react'
import * as Sentry from '@sentry/browser'
import { ErrorBoundary as ReactErrorBoundary } from 'react-error-boundary'
// import { BrowserTracing } from '@sentry/tracing'
// import * as Sentry from '@sentry/react'

const isServer = typeof window === 'undefined'

export async function notifyError(error, msg?: string) {
  console.log(msg, error)
  // if (msg && error?.message) {
  //     error.message = msg + ': ' + error?.message
  // }
  Sentry.captureException(error, { extra: { msg } })
  await Sentry.flush(1000) // delivery timeout in ms
}
