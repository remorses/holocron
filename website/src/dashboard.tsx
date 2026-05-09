// Dashboard pages for managing Holocron projects, API keys, and billing.
// Also hosts the /deploy flow (Vercel deploy button with prefilled credentials).
// Mounted on the root app via .use(dashboardApp) in server.tsx.
//
// All routes require session auth (redirect to /login if not logged in).
// Uses spiceflow .loader() + .layout() + .page() patterns.
//
// TODO: add rate limiter for AI chat (Cloudflare rate limiting binding)
// TODO: add usage tracking per project via KV
// TODO: add Stripe billing integration (checkout, portal, webhook)

import { Spiceflow, redirect, json } from 'spiceflow'
import { Link } from 'spiceflow/react'
import { z } from 'zod'
import { getDb, getSession, requireSession, ensureOrg, generateApiKey, hashApiKey } from './db.ts'
import * as schema from 'db/schema'

import { ulid } from 'ulid'
import { Button, CopyButton } from './components/ui/button.tsx'

// Vercel deploy button config
const TEMPLATE_REPO_URL = 'https://github.com/remorses/holocron/tree/main/template'
const DEPLOY_REDIRECT_URL = 'https://holocron.so/dashboard/deploy/callback'

// ── Dashboard layout with auth guard ────────────────────────────────

export const dashboardApp = new Spiceflow()

  // Auth guard for all /dashboard/* pages. Redirects to /login if no
  // session cookie. Loads the user's org for the layout header.
  .loader('/dashboard/*', async ({ request }) => {
    const session = await getSession(request)
    if (!session) {
      const returnTo = request.parsedUrl.pathname + (request.parsedUrl.search || '')
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

  // Shell layout: top nav bar with user email + settings link.
  // Wraps all /dashboard/* pages.
  .layout('/dashboard/*', async ({ children, loaderData }) => {
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
              <span>{loaderData.user.email}</span>
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

    return {
      projects: membership?.org?.projects ?? [],
    }
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
                  {new Date(project.createdAt).toLocaleDateString()}
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
      with: { domains: true, keys: true },
    })
    if (!project) throw redirect('/dashboard')

    return { project }
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

        {/* Domains */}
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-medium">Domains</h2>
          {project.domains.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              No domains detected yet. Deploy your docs site and domains will appear here.
            </div>
          ) : (
            <div className="rounded-lg border border-border">
              {project.domains.map((domain: typeof schema.projectDomain.$inferSelect, i: number) => (
                <div
                  key={domain.projectDomainId}
                  className={`flex items-center justify-between px-4 py-3 ${i > 0 ? 'border-t border-border' : ''}`}
                >
                  <div>
                    <div className="font-mono text-sm">{domain.host}{domain.basePath !== '/' ? domain.basePath : ''}</div>
                    <div className="mt-0.5 flex gap-2 text-xs text-muted-foreground">
                      <span className="rounded bg-muted px-1.5 py-0.5">{domain.platform}</span>
                      <span className="rounded bg-muted px-1.5 py-0.5">{domain.environment}</span>
                    </div>
                  </div>
                  {domain.lastSeenAt && (
                    <div className="text-xs text-muted-foreground">
                      Last seen {new Date(domain.lastSeenAt).toLocaleDateString()}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* API Keys */}
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-medium">API Keys</h2>
          {project.keys.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              No API keys for this project. Create one with the CLI: <code className="font-mono text-xs">holocron keys create --project {project.projectId}</code>
            </div>
          ) : (
            <div className="rounded-lg border border-border">
              {project.keys.map((key: typeof schema.apiKey.$inferSelect, i: number) => (
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

        {/* TODO: Stripe billing section */}
      </div>
    )
  })

  // ── Deploy flow ─────────────────────────────────────────────────────

  // Single-page deploy: auto-creates project + API key on first visit
  // (via server-side redirect), then shows the Vercel deploy button with
  // prefilled credentials and a code block alternative for local setup.
  .page({
    path: '/dashboard/deploy',
    query: z.object({
      projectId: z.string().optional(),
      key: z.string().optional(),
    }),
    handler: async ({ request, query }) => {
      const session = await requireSession(request)

      let projectId = query.projectId
      let fullKey = query.key

      // Auto-create project + API key if not already in URL
      if (!projectId || !fullKey) {
        const org = await ensureOrg(session.userId, session.user.name)
        const db = getDb()

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

        throw redirect(`/dashboard/deploy?projectId=${projectId}&key=${encodeURIComponent(fullKey)}`)
      }

      // Build Vercel deploy URL with prefilled env vars
      const deployUrl = new URL('https://vercel.com/new/clone')
      deployUrl.searchParams.set('repository-url', TEMPLATE_REPO_URL)
      deployUrl.searchParams.set('env', 'HOLOCRON_KEY')
      deployUrl.searchParams.set('envDefaults', JSON.stringify({
        HOLOCRON_KEY: fullKey,
      }))
      deployUrl.searchParams.set('envDescription', 'Your Holocron credentials (pre-filled, do not change)')
      deployUrl.searchParams.set('envLink', 'https://holocron.so/dashboard')
      deployUrl.searchParams.set('redirect-url', DEPLOY_REDIRECT_URL)
      deployUrl.searchParams.set('project-name', 'my-docs')

      return (
        <div className="flex flex-col items-center gap-10 py-16">
          <div className="flex max-w-lg flex-col items-center gap-8 text-center">
            <div className="flex flex-col gap-2">
              <h1 className="text-2xl font-semibold">Deploy Holocron template</h1>
              <div className="text-sm text-muted-foreground">
                Your project and API key are ready. Deploy with one click.
              </div>
            </div>

            <a
              href={deployUrl.toString()}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2.5 rounded-lg bg-black px-6 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:bg-black/90 hover:shadow-md dark:bg-white dark:text-black dark:hover:bg-white/90"
            >
              <svg height="14" viewBox="0 0 76 65" fill="currentColor">
                <path d="M37.5274 0L75.0548 65H0L37.5274 0Z" />
              </svg>
              Deploy on Vercel
            </a>

            <div className="flex w-full flex-col gap-3">
              <div className="text-sm text-muted-foreground">Or deploy locally:</div>
              <div className="relative w-full rounded-lg border border-border bg-muted/50 text-left">
                <CopyButton
                  text={`HOLOCRON_KEY=${fullKey}\n\nnpx @holocron.so/cli create`}
                  className="absolute right-2 top-2"
                />
                <div className="overflow-x-auto px-5 pt-12 pb-5">
                  <pre className="whitespace-pre font-mono text-sm leading-relaxed">{`HOLOCRON_KEY=${fullKey}\n\nnpx @holocron.so/cli create`}</pre>
                </div>
              </div>
            </div>
          </div>
        </div>
      )
    },
  })

  // Vercel redirects here after a successful deploy.
  // GitHub metadata is now registered at build time by the Vite plugin
  // (POST /api/v0/projects/:projectId/register-deployment), so this page
  // just shows a success message with links.
  .page({
    path: '/dashboard/deploy/callback',
    query: z.object({
      'project-name': z.string().optional(),
      'deployment-url': z.string().optional(),
    }),
    handler: async ({ request, query }) => {
      await requireSession(request)

      const deploymentUrl = query['deployment-url']

      return (
        <div className="flex flex-col items-center gap-6 py-16">
          <div className="flex max-w-md flex-col items-center gap-4 text-center">
            <h1 className="text-2xl font-semibold">Deployed!</h1>
            <div className="text-sm text-muted-foreground">
              Your docs site is live{deploymentUrl ? ` at ${deploymentUrl}` : ''}.
            </div>

            <div className="flex gap-3">
              {deploymentUrl && (
                <a href={`https://${deploymentUrl}`} target="_blank" rel="noopener noreferrer">
                  <Button>View Site</Button>
                </a>
              )}
              <Link href="/dashboard">
                <Button variant="outline">Go to Dashboard</Button>
              </Link>
            </div>
          </div>
        </div>
      )
    },
  })
