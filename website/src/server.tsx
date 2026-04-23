// Custom entry: mounts holocron as a child of a user Spiceflow app.
// Auth middleware (better-auth) runs first, then gateway routes (AI proxy),
// then holocron docs. The /docs.json route serves the Holocron JSON Schema.
// Cloudflare Workers fetch handler is provided by spiceflow/cloudflare-entrypoint.

import type { ReactNode } from 'react'
import { getActionRequest, json, parseFormData, Spiceflow, redirect } from 'spiceflow'
import { Head, router } from 'spiceflow/react'
import { z } from 'zod'
import { app as holocronApp } from '@holocron.so/vite/app'
import { gatewayApp } from './gateway'
import { getAuth, getSession, requireSession } from './db'
import { Button } from './components/ui/button.tsx'
import { DeviceActionButtons } from './components/device-action-buttons.tsx'
import schema from '@holocron.so/vite/src/schema.json'
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

function AuthPage({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-16">
      <Head>
        <Head.Title>{`${title} | Holocron`}</Head.Title>
        <Head.Meta name="description" content={description} />
      </Head>
      <section className="flex w-full max-w-md flex-col gap-6 rounded-xl border bg-card p-8 text-card-foreground shadow-sm">
        {children}
      </section>
    </main>
  )
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
          description="Sign in to manage your Holocron account and subscriptions."
          title="Sign in"
        >
          <div className="flex flex-col gap-2 text-center">
            <h1 className="text-3xl font-semibold tracking-tight">Holocron</h1>
            <p className="text-sm text-muted-foreground">
              Sign in to manage your account.
            </p>
          </div>
          <Button asChild className="w-full" size="lg">
            <a href={router.href('/login/google', { callbackURL })}>Sign in with Google</a>
          </Button>
        </AuthPage>
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
            description="Open this page from the CLI login flow with a valid device code."
            title="CLI login"
          >
            <div className="flex flex-col gap-2 text-center">
              <h1 className="text-2xl font-semibold tracking-tight">Holocron CLI Login</h1>
              <p className="text-sm text-muted-foreground">
                Open this page from the CLI login flow with a valid device code.
              </p>
            </div>
          </AuthPage>
        )
      }

      const auth = getAuth()
      const device = await auth.api.deviceVerify({ query: { user_code: userCode } }).catch(() => null)
      if (!device) {
        return (
          <AuthPage
            description="That CLI device code is invalid or expired."
            title="Invalid device code"
          >
            <div className="flex flex-col gap-2 text-center">
              <h1 className="text-2xl font-semibold tracking-tight">Invalid device code</h1>
              <p className="text-sm text-muted-foreground">
                That device code is invalid or expired.
              </p>
            </div>
          </AuthPage>
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
          description="Approve or deny the current Holocron CLI login request."
          title="CLI login"
        >
          <div className="flex flex-col gap-2 text-center">
            <h1 className="text-2xl font-semibold tracking-tight">Holocron CLI Login</h1>
            {status === 'approved'
              ? (
                  <>
                    <p className="text-sm text-foreground">The CLI was approved successfully.</p>
                    <p className="text-sm text-muted-foreground">
                      You can close this page and return to the terminal.
                    </p>
                  </>
                )
              : status === 'denied'
                ? (
                    <>
                      <p className="text-sm text-foreground">The CLI login was denied.</p>
                      <p className="text-sm text-muted-foreground">
                        You can close this page and start the login flow again.
                      </p>
                    </>
                  )
                : (
                    <>
                      <p className="text-sm text-foreground">
                        A CLI is requesting access to your account.
                      </p>
                      <p className="rounded-lg border bg-muted px-3 py-2 font-mono text-lg tracking-[0.24em] uppercase">
                        {userCode}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Current status: {device.status}. Approve to let the CLI finish logging in.
                      </p>
                    </>
                  )}
          </div>
          {status == null && <DeviceActionButtons approveAction={approveDevice} denyAction={denyDevice} userCode={userCode} />}
        </AuthPage>
      )
    },
  })

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
  .use(authApp)
  .use(schemaApp)
  .use(gatewayApp)
  .use(holocronApp)

export default {
  async fetch(request: Request): Promise<Response> {
    return app.handle(request)
  },
} satisfies ExportedHandler
