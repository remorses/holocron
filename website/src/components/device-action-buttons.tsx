// Client wrapper for device approval forms with error handling and pending states.
'use client'

import { ErrorBoundary } from 'spiceflow/react'
import { Button } from './ui/button.tsx'

type DeviceAction = (formData: FormData) => Promise<void>

function DeviceActionError() {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
      <ErrorBoundary.ErrorMessage className="text-sm text-destructive" />
      <ErrorBoundary.ResetButton className="text-sm font-medium text-destructive underline underline-offset-4">
        Try again
      </ErrorBoundary.ResetButton>
    </div>
  )
}

export function DeviceActionButtons({
  approveAction,
  denyAction,
  userCode,
}: {
  approveAction: DeviceAction
  denyAction: DeviceAction
  userCode: string
}) {
  return (
    <ErrorBoundary fallback={<DeviceActionError />}>
      <div className="flex w-full flex-col gap-3 sm:flex-row">
        <form action={approveAction} className="flex-1">
          <input name="userCode" type="hidden" value={userCode} />
          <Button className="w-full" loadingText="Approving..." type="submit">
            Approve CLI
          </Button>
        </form>
        <form action={denyAction} className="flex-1">
          <input name="userCode" type="hidden" value={userCode} />
          <Button className="w-full" loadingText="Denying..." type="submit" variant="outline">
            Deny
          </Button>
        </form>
      </div>
    </ErrorBoundary>
  )
}
