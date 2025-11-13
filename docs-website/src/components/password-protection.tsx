'use client'

import { useState } from 'react'
import { useRevalidator } from 'react-router'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { LockIcon } from 'lucide-react'
import { serialize as serializeCookie } from 'cookie'

export function PasswordProtection({ siteName }: { siteName?: string }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const revalidator = useRevalidator()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsSubmitting(true)

    try {
      const response = await fetch('/holocronInternalAPI/checkPassword', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password }),
      })

      const result = await response.json()

      if (result.valid) {
        document.cookie = serializeCookie('site_password', password, {
          path: '/',
          maxAge: 60 * 60 * 24 * 30,
          sameSite: 'lax',
        })
        revalidator.revalidate()
      } else {
        setError('Incorrect password')
        setIsSubmitting(false)
      }
    } catch (err) {
      setError('Failed to verify password')
      setIsSubmitting(false)
    }
  }

  return (
    <div className='flex min-h-screen items-center justify-center bg-fd-background px-4'>
      <div className='w-full max-w-md space-y-6'>
        <div className='flex flex-col items-center space-y-2 text-center'>
          <div className='flex size-16 items-center justify-center rounded-full bg-fd-primary/10'>
            <LockIcon className='size-8 text-fd-primary' />
          </div>
          <h1 className='text-2xl font-semibold text-fd-foreground'>
            Protected Documentation
          </h1>
          <p className='text-sm text-fd-muted-foreground'>
            {siteName ? `${siteName} requires a password to access` : 'This documentation requires a password to access'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className='space-y-4'>
          <div className='space-y-2'>
            <Input
              type='password'
              placeholder='Enter password'
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                setError('')
              }}
              disabled={isSubmitting}
              className='w-full'
              autoFocus
            />
            {error && (
              <p className='text-sm text-red-600 dark:text-red-400'>
                {error}
              </p>
            )}
          </div>

          <Button
            type='submit'
            className='w-full text-white'
            disabled={isSubmitting || !password}
          >
            {isSubmitting ? 'Verifying...' : 'Access Documentation'}
          </Button>
        </form>
      </div>
    </div>
  )
}
