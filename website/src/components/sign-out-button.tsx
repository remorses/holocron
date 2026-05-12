// Client component for signing out via better-auth's client API.
// The GET /api/auth/sign-out endpoint does not work reliably,
// so we use authClient.signOut() which POSTs to the correct endpoint.
'use client'

import { useState } from 'react'
import { createAuthClient } from 'better-auth/react'

const authClient = createAuthClient()

export function SignOutButton() {
  const [loading, setLoading] = useState(false)

  return (
    <button
      type="button"
      disabled={loading}
      onClick={async () => {
        setLoading(true)
        await authClient.signOut()
        window.location.href = '/login'
      }}
      className="inline-flex h-9 items-center justify-center rounded-md border bg-background px-4 text-sm font-medium shadow-xs transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-50"
    >
      {loading ? 'Signing out...' : 'Sign out'}
    </button>
  )
}
