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

function fallbackRender({ error, resetErrorBoundary }) {
    // Call resetErrorBoundary() to reset the error boundary and retry the render.

    return (
        <div role='alert'>
            <div>Something went wrong:</div>
            <pre className='truncate text-red-500'>{error.message}</pre>
        </div>
    )
}

export const ErrorBoundary: any = ({ children }) => {
    return (
        <ReactErrorBoundary
            onError={(err, info) => {
                notifyError(err, info.componentStack || '')
            }}
            fallbackRender={fallbackRender}
        >
            {children}
        </ReactErrorBoundary>
    )
}
