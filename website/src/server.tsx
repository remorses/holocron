// Custom entry: mounts holocron as a child of a user Spiceflow app.
// Auth middleware (better-auth) runs first, then gateway routes (AI proxy),
// then holocron docs. The /docs.json route serves the Holocron JSON Schema.
// Cloudflare Workers fetch handler is provided by spiceflow/cloudflare-entrypoint.

import { getActionRequest, json, parseFormData, Spiceflow, redirect } from 'spiceflow'
import { router } from 'spiceflow/react'
import { z } from 'zod'
import { app as holocronApp } from '@holocron.so/vite/app'
import { gatewayApp } from './gateway.ts'
import { apiApp } from './api.ts'
import { getAuth, getSession, requireSession } from './db.ts'
import { AuthPage } from './components/auth-page.tsx'
import { Button } from './components/ui/button.tsx'
import { DeviceActionButtons } from './components/device-action-buttons.tsx'
import schema from '@holocron.so/vite/src/schema.json' with { type: 'json' }
import './globals.css'

const loginQuerySchema = z.object({ callbackURL: z.string().optional() })

const devicePageQuerySchema = z.object({
  user_code: z.string().optional(),
  status: z.enum(['approved', 'denied']).optional(),
})

const deviceUserCodeSchema = z.object({ userCode: z.string().min(1) })

function safeRedirectPath(value: string | undefined) {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/'
  return value
}

async function createGoogleSignInRedirect(request: Pick<Request, 'headers'>, callbackURL: string) {
  const auth = getAuth()
  const { response, headers } = await auth.api.signInSocial({
    body: { provider: 'google', callbackURL },
    headers: request.headers,
    returnHeaders: true,
  })
  if (!response?.url) {
    throw json({ error: 'failed to start google sign-in' }, { status: 500 })
  }

  const redirectResponse = new Response(null, {
    status: 302,
    headers: { Location: response.url },
  })
  for (const cookie of headers.getSetCookie()) {
    redirectResponse.headers.append('Set-Cookie', cookie)
  }
  return redirectResponse
}

const schemaApp = new Spiceflow()
  .get('/docs.json', () => {
    return Response.json(schema, {
      headers: { 'access-control-allow-origin': '*' },
    })
  })

// ── Auth app: middleware + login + device pages ─────────────────────

const authApp = new Spiceflow()

  // Login page
  .page({
    path: '/login',
    query: loginQuerySchema,
    handler: async ({ request, query }) => {
      const session = await getSession(request)
      if (session) throw redirect('/')
      const callbackURL = safeRedirectPath(query.callbackURL)
      return (
        <AuthPage
          title="Holocron"
          headTitle="Sign in"
          description="Sign in to manage your account."
          footer={
            <Button asChild className="w-full" size="lg">
              <a href={router.href('/login/google', { callbackURL })}>Sign in with Google</a>
            </Button>
          }
        />
      )
    },
  })

  // Google sign-in redirect (creates OAuth redirect with cookies forwarded)
  .route({
    method: 'GET',
    path: '/login/google',
    query: loginQuerySchema,
    async handler({ request, query }) {
      return createGoogleSignInRedirect(request, safeRedirectPath(query.callbackURL))
    },
  })

  // Device flow verification page
  .page({
    path: '/device',
    query: devicePageQuerySchema,
    handler: async ({ request, query }) => {
      const userCode = query.user_code ?? ''
      const status = query.status

      if (!userCode) {
        return (
          <AuthPage
            title="CLI Login"
            description="Open this page from the CLI login flow with a valid device code."
          />
        )
      }

      const auth = getAuth()
      const device = await auth.api.deviceVerify({ query: { user_code: userCode } }).catch(() => null)
      if (!device) {
        return (
          <AuthPage
            title="Invalid Device Code"
            description="That device code is invalid or expired. Start the CLI login flow again."
          />
        )
      }

      if (status === 'approved') {
        return (
          <AuthPage
            title="CLI Approved"
            description="You can close this page and return to the terminal."
          />
        )
      }

      if (status === 'denied') {
        return (
          <AuthPage
            title="CLI Denied"
            description="You can close this page and start the login flow again."
          />
        )
      }

      const session = await getSession(request)
      if (!session) {
        throw redirect(
          router.href('/login', {
            callbackURL: `${request.parsedUrl.pathname}${request.parsedUrl.search}`,
          }),
        )
      }

      async function approveDevice(formData: FormData) {
        'use server'
        const actionRequest = getActionRequest()
        await requireSession(actionRequest)
        const { userCode: parsedUserCode } = parseFormData(deviceUserCodeSchema, formData)
        const actionAuth = getAuth()
        await actionAuth.api.deviceApprove({ body: { userCode: parsedUserCode }, headers: actionRequest.headers })
        throw redirect(router.href('/device', { user_code: parsedUserCode, status: 'approved' }))
      }

      async function denyDevice(formData: FormData) {
        'use server'
        const actionRequest = getActionRequest()
        await requireSession(actionRequest)
        const { userCode: parsedUserCode } = parseFormData(deviceUserCodeSchema, formData)
        const actionAuth = getAuth()
        await actionAuth.api.deviceDeny({ body: { userCode: parsedUserCode }, headers: actionRequest.headers })
        throw redirect(router.href('/device', { user_code: parsedUserCode, status: 'denied' }))
      }

      return (
        <AuthPage
          title="CLI Login"
          description="A CLI is requesting access to your account."
          footer={
            <DeviceActionButtons approveAction={approveDevice} denyAction={denyDevice} userCode={userCode} />
          }
        >
          <div className="flex justify-center">
            <div className="rounded-lg border bg-muted px-4 py-2.5 font-mono text-lg tracking-widest">
              {userCode}
            </div>
          </div>
        </AuthPage>
      )
    },
  })

// ── Preview routes (dev only) — renders each auth page state ────────

const previewApp = new Spiceflow()

  .page('/preview', () => (
    <main className="flex min-h-screen flex-col items-center gap-4 px-6 py-16">
      <h1 className="text-2xl font-semibold">Page Previews</h1>
      <nav className="flex flex-col gap-2 text-sm">
        <a href="/preview/login" className="text-primary underline underline-offset-4">Login</a>
        <a href="/preview/device-empty" className="text-primary underline underline-offset-4">Device — no code</a>
        <a href="/preview/device-invalid" className="text-primary underline underline-offset-4">Device — invalid code</a>
        <a href="/preview/device-pending" className="text-primary underline underline-offset-4">Device — pending approval</a>
        <a href="/preview/device-approved" className="text-primary underline underline-offset-4">Device — approved</a>
        <a href="/preview/device-denied" className="text-primary underline underline-offset-4">Device — denied</a>
      </nav>
    </main>
  ))

  .page('/preview/login', () => (
    <AuthPage
      title="Holocron"
      headTitle="Sign in"
      description="Sign in to manage your account."
      footer={
        <Button asChild className="w-full" size="lg">
          <a href="#">Sign in with Google</a>
        </Button>
      }
    />
  ))

  .page('/preview/device-empty', () => (
    <AuthPage
      title="CLI Login"
      description="Open this page from the CLI login flow with a valid device code."
    />
  ))

  .page('/preview/device-invalid', () => (
    <AuthPage
      title="Invalid Device Code"
      description="That device code is invalid or expired. Start the CLI login flow again."
    />
  ))

  .page('/preview/device-pending', () => (
    <AuthPage
      title="CLI Login"
      description="A CLI is requesting access to your account."
      footer={
        <div className="flex w-full flex-col gap-3 sm:flex-row">
          <Button className="flex-1" type="button">Approve CLI</Button>
          <Button className="flex-1" type="button" variant="outline">Deny</Button>
        </div>
      }
    >
      <div className="flex justify-center">
        <div className="rounded-lg border bg-muted px-4 py-2.5 font-mono text-lg tracking-widest">
          ABCD-1234
        </div>
      </div>
    </AuthPage>
  ))

  .page('/preview/device-approved', () => (
    <AuthPage
      title="CLI Approved"
      description="You can close this page and return to the terminal."
    />
  ))

  .page('/preview/device-denied', () => (
    <AuthPage
      title="CLI Denied"
      description="You can close this page and start the login flow again."
    />
  ))

// BetterAuth middleware — must be on the root app so it intercepts /api/auth/*
// before holocron can render a 404 page. Child app middleware only runs for
// routes that child app owns.
export const app = new Spiceflow()
  .use(async ({ request }, next) => {
    if (request.parsedUrl.pathname.startsWith('/api/auth')) {
      const auth = getAuth()
      const res = await auth.handler(request)
      if (res.status !== 404) return res
    }
    return next()
  })
  .use(previewApp)
  .use(authApp)
  .use(apiApp)
  .use(schemaApp)
  .use(gatewayApp)
  .use(holocronApp)

export type App = typeof app

export default {
  async fetch(request: Request): Promise<Response> {
    return app.handle(request)
  },
} satisfies ExportedHandler
