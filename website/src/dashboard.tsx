// Dashboard pages for managing Holocron projects, API keys, and billing.
// Also hosts the /deploy flow (GitHub template button + local CLI setup).
// Mounted on the root app via .use(dashboardApp) in server.tsx.
//
// All routes require session auth (redirect to /login if not logged in).
// Uses spiceflow .loader() + .layout() + .page() patterns.
//
// TODO: add rate limiter for AI chat (Cloudflare rate limiting binding)
// TODO: add usage tracking per project via KV
// TODO: add Stripe billing integration (checkout, portal, webhook)

import { Spiceflow, redirect } from 'spiceflow'
import { Link } from 'spiceflow/react'
import { z } from 'zod'
import { getDb, getSession, requireSession, ensureOrg, generateApiKey, hashApiKey } from './db.ts'
import * as schema from 'db/schema'
import { normalizeAuthRedirectPath } from './auth-redirect.ts'

import { ulid } from 'ulid'
import { Button, CopyButton } from './components/ui/button.tsx'
import { SignOutButton } from './components/sign-out-button.tsx'
import { DeployPoller } from './components/deploy-poller.tsx'

const TEMPLATE_REPO_URL = 'https://github.com/remorses/holocron-template'
const DEPLOY_KEY_COOKIE = 'holocron_deploy_key'

function readDeployKeyCookie(request: Request, projectId: string): string | undefined {
  const cookies = request.headers.get('cookie') ?? ''
  const cookie = cookies.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${DEPLOY_KEY_COOKIE}=`))
  const value = cookie?.slice(DEPLOY_KEY_COOKIE.length + 1)
  if (!value) return undefined
  const [cookieProjectId, key] = decodeURIComponent(value).split(':')
  return cookieProjectId === projectId ? key : undefined
}

function deployKeyCookie({ request, projectId, fullKey }: { request: Request; projectId: string; fullKey: string }): string {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : ''
  return `${DEPLOY_KEY_COOKIE}=${encodeURIComponent(`${projectId}:${fullKey}`)}; Max-Age=120; Path=/dashboard/deploy; HttpOnly; SameSite=Lax${secure}`
}

/** Format an epoch-ms timestamp as "3 days ago", "just now", etc. */
function timeAgo(epochMs: number): string {
  const seconds = Math.round((Date.now() - epochMs) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(seconds / 3600)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(seconds / 86400)
  if (days < 30) return `${days}d ago`
  const months = Math.round(seconds / 2592000)
  if (months < 12) return `${months}mo ago`
  const years = Math.round(seconds / 31536000)
  return `${years}y ago`
}

// ── Dashboard layout with auth guard ────────────────────────────────

export const dashboardApp = new Spiceflow()

  // Auth guard for all /dashboard/* pages. Redirects to /login if no
  // session cookie. Loads the user's org for the layout header.
  .loader('/dashboard/*', async ({ request }) => {
    const session = await getSession(request)
    if (!session) {
      const returnTo = normalizeAuthRedirectPath(request.parsedUrl.pathname + (request.parsedUrl.search || ''))
      throw redirect(`/login?callbackURL=${encodeURIComponent(returnTo)}`)
    }

    const db = getDb()
    const membership = await db.query.orgMember.findFirst({
      where: { userId: session.userId },
      with: { org: true },
    })

    return {
      user: session.user,
      org: membership?.org ?? null,
      orgId: membership?.org?.id ?? null,
    }
  })

  // Shell layout: top nav bar with navigation links.
  // Wraps all /dashboard/* pages.
  .layout('/dashboard/*', async ({ children }) => {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <header className="border-b border-border">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
            <Link href="/dashboard" className="no-underline flex items-center shrink-0">
              <img
                src="/api/ai-logo/holocron.jpeg"
                alt="Holocron"
                className="dark:hidden"
                style={{ height: 30, width: 'auto', mixBlendMode: 'multiply' }}
              />
              <img
                src="/api/ai-logo/holocron.jpeg"
                alt="Holocron"
                className="hidden dark:block"
                style={{ height: 30, width: 'auto', mixBlendMode: 'screen', filter: 'invert(1)' }}
              />
            </Link>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <Link href="/dashboard" className="hover:text-foreground">Projects</Link>
              <Link href="/dashboard/settings" className="hover:text-foreground">Settings</Link>
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-6 py-8">
          {children}
        </main>
      </div>
    )
  })

  // ── Project list ────────────────────────────────────────────────────

  // Called when: user visits /dashboard. Fetches all projects for the org.
  .loader('/dashboard', async ({ request }) => {
    const session = await requireSession(request)
    const db = getDb()

    const membership = await db.query.orgMember.findFirst({
      where: { userId: session.userId },
      with: { org: { with: { projects: true } } },
    })

    const projects = (membership?.org?.projects ?? [])
      .slice()
      .sort((a, b) => b.updatedAt - a.updatedAt)

    return { projects }
  })

  // Main dashboard page: lists all projects as cards. Shows empty states
  // when no org or no projects exist, with CTA to /deploy.
  .page('/dashboard', async ({ loaderData }) => {
    const { projects, org } = loaderData

    return (
      <div className="flex flex-col gap-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Projects</h1>
            <div className="mt-1 text-sm text-muted-foreground">
              Manage your documentation sites.
            </div>
          </div>
          {org && (
            <Link href="/dashboard/deploy">
              <Button>New Project</Button>
            </Link>
          )}
        </div>

        {/* TODO: show upgrade banner when org.subscriptionStatus !== 'active' */}

        {!org && (
          <div className="rounded-lg border border-border bg-muted/50 px-6 py-8 text-center">
            <div className="text-lg font-medium">No organization yet</div>
            <div className="mt-1 text-sm text-muted-foreground">
              Create your first project to get started.
            </div>
            <Link href="/dashboard/deploy" className="mt-4 inline-block">
              <Button>Create Project</Button>
            </Link>
          </div>
        )}

        {org && projects.length === 0 && (
          <div className="rounded-lg border border-border bg-muted/50 px-6 py-8 text-center">
            <div className="text-lg font-medium">No projects yet</div>
            <div className="mt-1 text-sm text-muted-foreground">
              Deploy your first docs site to see it here.
            </div>
          </div>
        )}

        {projects.length > 0 && (
          <div className="grid gap-4">
            {projects.map((project: typeof schema.project.$inferSelect) => (
              <Link
                key={project.projectId}
                href={`/dashboard/projects/${project.projectId}`}
                className="flex items-center justify-between rounded-lg border border-border px-5 py-4 transition-colors hover:bg-muted/50"
              >
                <div>
                  <div className="font-medium">{project.name}</div>
                  {project.githubOwner && project.githubRepo && (
                    <div className="mt-0.5 text-sm text-muted-foreground">
                      {project.githubOwner}/{project.githubRepo}
                    </div>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  Updated {timeAgo(project.updatedAt)}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    )
  })

  // ── Single project ──────────────────────────────────────────────────

  // Called when: user clicks a project card on /dashboard. Loads project
  // with its domains and API keys for display.
  .loader('/dashboard/projects/:projectId', async ({ request, params }) => {
    const session = await requireSession(request)
    const db = getDb()

    const membership = await db.query.orgMember.findFirst({
      where: { userId: session.userId },
    })
    if (!membership) throw redirect('/dashboard')

    const project = await db.query.project.findFirst({
      where: { projectId: params.projectId, orgId: membership.orgId },
      with: { keys: true },
    })
    if (!project) throw redirect('/dashboard')

    return {
      project: {
        ...project,
        keys: project.keys.map(({ id, name, prefix, projectId, createdAt }) => ({
          id,
          name,
          prefix,
          projectId,
          createdAt,
        })),
      },
    }
  })

  // Single project page: shows detected domains and API keys for this project.
  .page('/dashboard/projects/:projectId', async ({ loaderData }) => {
    const { project } = loaderData

    return (
      <div className="flex flex-col gap-8">
        <div>
          <Link href="/dashboard" className="text-sm text-muted-foreground hover:text-foreground">
            ← Projects
          </Link>
          <h1 className="mt-2 text-2xl font-semibold">{project.name}</h1>
          {project.githubOwner && project.githubRepo && (
            <a
              href={`https://github.com/${project.githubOwner}/${project.githubRepo}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 text-sm text-muted-foreground hover:text-foreground"
            >
              {project.githubOwner}/{project.githubRepo} ↗
            </a>
          )}
        </div>

        {/* API Keys */}
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-medium">API Keys</h2>
          {project.keys.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              No API keys for this project. Create one with the CLI: <code className="font-mono text-xs">holocron keys create --project {project.projectId}</code>
            </div>
          ) : (
            <div className="rounded-lg border border-border">
              {project.keys.map((key: { id: string; name: string; prefix: string; projectId: string; createdAt: number }, i: number) => (
                <div
                  key={key.id}
                  className={`flex items-center justify-between px-4 py-3 ${i > 0 ? 'border-t border-border' : ''}`}
                >
                  <div>
                    <div className="text-sm font-medium">{key.name}</div>
                    <div className="mt-0.5 font-mono text-xs text-muted-foreground">holo_{key.prefix}...</div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(key.createdAt).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    )
  })

  // ── Settings page ───────────────────────────────────────────────────

  // Called when: user clicks "Settings" in the dashboard nav bar.
  // Shows account info and org details. Stripe billing section is TODO.
  .page('/dashboard/settings', async ({ loaderData }) => {
    const { user, org } = loaderData

    return (
      <div className="flex flex-col gap-8">
        <div>
          <h1 className="text-2xl font-semibold">Settings</h1>
        </div>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-medium">Account</h2>
          <div className="rounded-lg border border-border px-4 py-3">
            <div className="text-sm">{user.name}</div>
            <div className="text-sm text-muted-foreground">{user.email}</div>
          </div>
        </section>

        {org && (
          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-medium">Organization</h2>
            <div className="rounded-lg border border-border px-4 py-3">
              <div className="text-sm font-medium">{org.name}</div>
              <div className="mt-0.5 font-mono text-xs text-muted-foreground">{org.id}</div>
            </div>
          </section>
        )}

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-medium">Session</h2>
          <SignOutButton />
        </section>

        {/* TODO: Stripe billing section */}
      </div>
    )
  })

  // ── Deploy flow ─────────────────────────────────────────────────────

  // Single-page deploy: auto-creates project + API key on first visit
  // (via server-side redirect), then shows the GitHub template button
  // and a local setup alternative. If the user created their repo from
  // the template with the same GitHub account they signed in with,
  // the OIDC flow auto-links the project on the first `vite build`.
  .page({
    path: '/dashboard/deploy',
    query: z.object({
      projectId: z.string().optional(),
    }),
    handler: async ({ request, query }) => {
      const session = await requireSession(request)

      let projectId = query.projectId
      let fullKey: string | undefined
      const org = await ensureOrg(session.userId, session.user.name)
      const db = getDb()

      if (projectId) {
        const project = await db.query.project.findFirst({
          where: { projectId, orgId: org.id },
        })
        if (!project) throw redirect('/dashboard')
        if (project.currentDeploymentId) throw redirect(`/dashboard/projects/${projectId}`)
        fullKey = readDeployKeyCookie(request, projectId)
      }

      // Auto-create project + API key on first load. Redirect with only the
      // project id in the URL, and keep the one-time full key in a short-lived
      // HttpOnly cookie so reloads never create duplicate projects.
      if (!projectId) {
        projectId = ulid()
        const generated = generateApiKey()
        fullKey = generated.fullKey
        const keyHash = await hashApiKey(fullKey)

        await db.batch([
          db.insert(schema.project).values({
            projectId,
            orgId: org.id,
            name: `${session.user.name}'s Docs`,
          }),
          db.insert(schema.apiKey).values({
            id: ulid(),
            orgId: org.id,
            projectId,
            name: 'deploy',
            prefix: generated.prefix,
            hash: keyHash,
          }),
        ])

        throw redirect(`/dashboard/deploy?projectId=${projectId}`, {
          headers: { 'Set-Cookie': deployKeyCookie({ request, projectId, fullKey }) },
        })
      }

      const templateUrl = `${TEMPLATE_REPO_URL}/generate`

      return (
        <div className="flex flex-col items-center gap-10 py-16">
          <DeployPoller />
          <div className="flex max-w-lg flex-col items-center gap-8 text-center">
            <div className="flex flex-col gap-2">
              <h1 className="text-2xl font-semibold">Create your docs site</h1>
              <div className="text-sm text-muted-foreground">
                Create a new repo from the Holocron template. Your site will be
                automatically linked to this project via GitHub Actions.
              </div>
            </div>

            <a
              href={templateUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2.5 rounded-lg bg-black px-6 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:bg-black/90 hover:shadow-md dark:bg-white dark:text-black dark:hover:bg-white/90"
            >
              <svg height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
              </svg>
              Create example GitHub repo
            </a>

            <div className="flex w-full flex-col gap-3">
              <div className="text-sm text-muted-foreground">Or create locally with the CLI:</div>
              <div className="relative w-full rounded-lg border border-border bg-muted/50 text-left">
                <CopyButton
                  text="npx -y @holocron.so/cli create"
                  className="absolute right-2 top-2"
                />
                <div className="overflow-x-auto px-5 py-4">
                  <pre className="whitespace-pre font-mono text-sm leading-relaxed">npx -y @holocron.so/cli create</pre>
                </div>
              </div>
            </div>

            {fullKey && (
              <div className="w-full rounded-lg border border-border bg-muted/30 px-5 py-4 text-left">
                <div className="text-xs font-medium text-muted-foreground mb-2">Your API key</div>
                <div className="relative">
                  <CopyButton text={fullKey} className="absolute right-0 top-0" />
                  <code className="font-mono text-sm break-all">{`holo_${fullKey.slice(5, 9)}${'•'.repeat(12)}${fullKey.slice(-4)}`}</code>
                </div>
                <div className="mt-3 text-xs text-muted-foreground leading-relaxed">
                  Set <code className="font-mono">HOLOCRON_KEY</code> as an env var in your deploy environment (Vercel, Cloudflare, etc.) to link this project during deployment. Not needed for GitHub Actions deploys, which use OIDC automatically.
                </div>
              </div>
            )}
          </div>
        </div>
      )
    },
  })
