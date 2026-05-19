// Client auth buttons: sign-in (with loading state during redirect) and sign-out.
// The GET /api/auth/sign-out endpoint does not work reliably,
// so we use authClient.signOut() which POSTs to the correct endpoint.
'use client'

import { useState } from 'react'
import { createAuthClient } from 'better-auth/react'
import { Button } from './ui/button.tsx'

const authClient = createAuthClient()

export function SignInButton({ href, children }: { href: string; children: React.ReactNode }) {
  const [loading, setLoading] = useState(false)

  return (
    <Button
      className="w-full"
      size="lg"
      loading={loading}
      loadingText="Redirecting..."
      onClick={() => {
        setLoading(true)
        window.location.href = href
      }}
    >
      {children}
    </Button>
  )
}

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
