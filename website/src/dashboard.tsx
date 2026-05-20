// Dashboard pages for managing Holocron projects, deployments, and team.
// Mounted on the root app via .use(dashboardApp) in server.tsx.
//
// Layout: Sigillo-style sidebar (project list) + tab bar per project.
// All routes require session auth (redirect to /login if not logged in).
//
// Routes:
//   /dashboard                           → redirect to first project or empty state
//   /dashboard/projects/:projectId       → overview tab (project info, keys, deployments)
//   /dashboard/projects/:projectId/members   → org members table
//   /dashboard/projects/:projectId/assistant → coming soon
//   /dashboard/projects/:projectId/analytics → coming soon
//   /dashboard/projects/:projectId/settings  → coming soon
//   /dashboard/deploy                    → create project flow

import { Spiceflow, redirect } from 'spiceflow'
import { Link } from 'spiceflow/react'
import { z } from 'zod'
import { getDb, getSession, requireSession, ensureOrg, generateApiKey, hashApiKey } from './db.ts'
import * as schema from 'db/schema'
import { normalizeAuthRedirectPath } from './auth-redirect.ts'
import { ulid } from 'ulid'
import { cn, timeAgo } from './lib/utils.ts'
import { Button, CopyButton } from './components/ui/button.tsx'
import { DeployPoller } from './components/deploy-poller.tsx'
import { HolocronLogo } from './components/auth-page.tsx'
import { Frame } from './components/ui/frame.tsx'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './components/ui/table.tsx'
import {
  GridDot,
  DashboardSidebar,
  ProjectTabBar,
  MembersTable,
  ComingSoon,
} from './dashboard-components.tsx'

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

// ── Dashboard app ───────────────────────────────────────────────────

export const dashboardApp = new Spiceflow()

  // Auth guard for all /dashboard/* pages
  .loader('/dashboard/*', async ({ request }) => {
    const session = await getSession(request)
    if (!session) {
      const returnTo = normalizeAuthRedirectPath(request.parsedUrl.pathname + (request.parsedUrl.search || ''))
      throw redirect(`/login?callbackURL=${encodeURIComponent(returnTo)}`)
    }

    const db = getDb()
    const membership = await db.query.orgMember.findFirst({
      where: { userId: session.userId },
      with: { org: { with: { projects: true } } },
    })

    const projects = (membership?.org?.projects ?? [])
      .slice()
      .sort((a, b) => b.updatedAt - a.updatedAt)

    return {
      user: session.user,
      org: membership?.org ?? null,
      orgId: membership?.org?.id ?? null,
      projects,
    }
  })

  // Shell layout: navbar + sidebar + main content area
  .layout('/dashboard/*', async ({ children, loaderData, request }) => {
    const { user, projects, org } = loaderData
    // Extract projectId from the URL path since layout runs before sub-loaders
    const pathMatch = request.parsedUrl.pathname.match(/^\/dashboard\/projects\/([^/]+)/)
    const projectId = pathMatch?.[1] ?? null
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col">
        {/* Navbar */}
        <header className="border-b border-border">
          <div className="mx-auto flex max-w-(--content-max-width) items-center justify-between px-6 py-4 border-x border-border relative">
            <GridDot position="bl" />
            <GridDot position="br" />
            <Link href="/dashboard" className="no-underline flex items-center shrink-0">
              <HolocronLogo />
            </Link>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <Link href="/" className="hover:text-foreground no-underline">Docs</Link>
              <a href="https://github.com/remorses/holocron" target="_blank" rel="noopener noreferrer" className="hover:text-foreground no-underline">GitHub</a>
            </div>
          </div>
        </header>

        {/* Content area with sidebar */}
        <div className="isolate grow relative flex max-w-(--content-max-width) mx-auto w-full border-x border-border">
          <GridDot position="tl" />
          <GridDot position="tr" />
          <DashboardSidebar
            projects={projects}
            currentProjectId={projectId}
            org={org ? { id: org.id, name: org.name } : null}
            user={{ name: user.name, email: user.email, image: user.image }}
          />
          <div className="flex-1 flex flex-col min-w-0">
            {children}
          </div>
        </div>
      </div>
    )
  })

  // ── Dashboard index → redirect to first project ────────────────────

  .page('/dashboard', async ({ loaderData }) => {
    const { projects, org } = loaderData
    const firstProject = projects[0]
    if (firstProject) {
      throw redirect(`/dashboard/projects/${firstProject.projectId}`)
    }

    return (
      <div className="flex flex-col items-center justify-center py-24 text-center px-6">
        {!org ? (
          <>
            <div className="text-lg font-medium">No organization yet</div>
            <div className="mt-1 text-sm text-muted-foreground">Create your first project to get started.</div>
            <Link href="/dashboard/deploy" className="mt-4 inline-block">
              <Button>Create Project</Button>
            </Link>
          </>
        ) : (
          <>
            <div className="text-lg font-medium">No projects yet</div>
            <div className="mt-1 text-sm text-muted-foreground">Deploy your first docs site to see it here.</div>
            <Link href="/dashboard/deploy" className="mt-4 inline-block">
              <Button>Create Project</Button>
            </Link>
          </>
        )}
      </div>
    )
  })

  // ── Project overview tab ───────────────────────────────────────────

  .loader('/dashboard/projects/:projectId', async ({ request, params }) => {
    const session = await requireSession(request)
    const db = getDb()

    const membership = await db.query.orgMember.findFirst({
      where: { userId: session.userId },
    })
    if (!membership) throw redirect('/dashboard')

    const project = await db.query.project.findFirst({
      where: { projectId: params.projectId, orgId: membership.orgId },
      with: {
        deployments: {
          orderBy: { createdAt: 'desc' },
          limit: 20,
          with: { triggeredByUser: true },
        },
      },
    })
    if (!project) throw redirect('/dashboard')

    return {
      project: {
        ...project,
        deployments: project.deployments.map((d) => ({
          id: d.id,
          status: d.status,
          branch: d.branch,
          preview: d.preview,
          subdomain: d.subdomain,
          githubActor: d.githubActor,
          createdAt: d.createdAt,
          triggeredByUser: d.triggeredByUser ? {
            name: d.triggeredByUser.name,
            image: d.triggeredByUser.image,
          } : null,
        })),
      },
    }
  })

  .page('/dashboard/projects/:projectId', async ({ loaderData }) => {
    const { project } = loaderData

    const siteUrl = project.subdomain
      ? `https://${project.subdomain}-site.holocron.so`
      : null

    return (
      <>
        <ProjectTabBar projectId={project.projectId} currentTab="overview" />
        <div className="border-t border-border" />
        <main className="flex-1 p-4 sm:p-6 overflow-x-hidden overflow-y-auto min-w-0">
          <div className="flex flex-col gap-6">
            {/* Header */}
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{project.name}</h1>
              {project.githubOwner && project.githubRepo && (
                <a
                  href={`https://github.com/${project.githubOwner}/${project.githubRepo}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                >
                  {project.githubOwner}/{project.githubRepo} ↗
                </a>
              )}
            </div>

            {/* Project info */}
            <section className="flex flex-col gap-3">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Project Info</h2>
              <Frame className="w-full">
                <div className="rounded-xl border bg-background p-4">
                  <dl className="grid grid-cols-[auto_1fr] gap-x-8 gap-y-3 text-sm">
                    {siteUrl && (
                      <>
                        <dt className="text-muted-foreground">Website</dt>
                        <dd>
                          <a href={siteUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                            {siteUrl} ↗
                          </a>
                        </dd>
                      </>
                    )}
                    {project.githubOwner && project.githubRepo && (
                      <>
                        <dt className="text-muted-foreground">GitHub</dt>
                        <dd>
                          <a
                            href={`https://github.com/${project.githubOwner}/${project.githubRepo}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline"
                          >
                            {project.githubOwner}/{project.githubRepo} ↗
                          </a>
                        </dd>
                      </>
                    )}
                    <dt className="text-muted-foreground">Default Branch</dt>
                    <dd className="font-mono text-xs">{project.defaultBranch || 'main'}</dd>
                    <dt className="text-muted-foreground">Created</dt>
                    <dd>{timeAgo(project.createdAt)}</dd>
                  </dl>
                </div>
              </Frame>
            </section>

            {/* Recent Deployments */}
            <section className="flex flex-col gap-3">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Recent Deployments</h2>
              {project.deployments.length === 0 ? (
                <div className="text-sm text-muted-foreground">No deployments yet.</div>
              ) : (
                <Frame className="w-full">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead>URL</TableHead>
                        <TableHead>Time</TableHead>
                        <TableHead>User</TableHead>
                        <TableHead>Branch</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {project.deployments.map((d) => {
                        const deployUrl = d.subdomain
                          ? `https://${d.subdomain}-site${d.preview ? '-preview' : ''}.holocron.so`
                          : null
                        // Resolve avatar: prefer triggeredByUser.image, then githubActor
                        const avatarUrl = d.triggeredByUser?.image
                          || (d.githubActor ? `https://github.com/${d.githubActor}.png?size=32` : null)
                        const userName = d.triggeredByUser?.name || d.githubActor || '—'

                        return (
                          <TableRow key={d.id}>
                            <TableCell>
                              {deployUrl ? (
                                <a
                                  href={deployUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-primary hover:underline font-mono truncate max-w-48 block"
                                >
                                  {d.subdomain}
                                </a>
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <span className="text-xs text-muted-foreground tabular-nums">
                                {timeAgo(d.createdAt)}
                              </span>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1.5">
                                {avatarUrl ? (
                                  <img src={avatarUrl} alt="" className="size-5 rounded-full object-cover" />
                                ) : null}
                                <span className="text-xs">{userName}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <span className="font-mono text-xs text-muted-foreground">{d.branch || 'main'}</span>
                            </TableCell>
                            <TableCell>
                              <span className={cn(
                                'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium leading-none',
                                d.status === 'active' && 'bg-green-500/10 text-green-600',
                                d.status === 'uploading' && 'bg-yellow-500/10 text-yellow-600',
                                d.status === 'superseded' && 'bg-muted text-muted-foreground',
                              )}>
                                {d.status}
                              </span>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </Frame>
              )}
            </section>
          </div>
        </main>
      </>
    )
  })

  // ── Members tab ────────────────────────────────────────────────────

  .loader('/dashboard/projects/:projectId/members', async ({ request, params }) => {
    const session = await requireSession(request)
    const db = getDb()

    const membership = await db.query.orgMember.findFirst({
      where: { userId: session.userId },
    })
    if (!membership) throw redirect('/dashboard')

    const project = await db.query.project.findFirst({
      where: { projectId: params.projectId, orgId: membership.orgId },
    })
    if (!project) throw redirect('/dashboard')

    const members = await db.query.orgMember.findMany({
      where: { orgId: membership.orgId },
      with: { user: true },
    })

    return { project, members }
  })

  .page('/dashboard/projects/:projectId/members', async ({ loaderData }) => {
    const { project, members } = loaderData

    return (
      <>
        <ProjectTabBar projectId={project.projectId} currentTab="members" />
        <div className="border-t border-border" />
        <main className="flex-1 p-4 sm:p-6 overflow-x-hidden overflow-y-auto min-w-0">
          <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold tracking-tight">{project.name}</h1>
            </div>
            <MembersTable members={members} />
          </div>
        </main>
      </>
    )
  })

  // ── API Keys tab ────────────────────────────────────────────────────

  .loader('/dashboard/projects/:projectId/keys', async ({ request, params }) => {
    const session = await requireSession(request)
    const db = getDb()
    const membership = await db.query.orgMember.findFirst({ where: { userId: session.userId } })
    if (!membership) throw redirect('/dashboard')
    const project = await db.query.project.findFirst({
      where: { projectId: params.projectId, orgId: membership.orgId },
      with: { keys: true },
    })
    if (!project) throw redirect('/dashboard')
    return {
      project,
      keys: project.keys.map(({ id, name, prefix, projectId, createdAt }) => ({
        id, name, prefix, projectId, createdAt,
      })),
    }
  })

  .page('/dashboard/projects/:projectId/keys', async ({ loaderData }) => {
    const { project, keys } = loaderData
    return (
      <>
        <ProjectTabBar projectId={project.projectId} currentTab="keys" />
        <div className="border-t border-border" />
        <main className="flex-1 p-4 sm:p-6 overflow-x-hidden overflow-y-auto min-w-0">
          <div className="flex flex-col gap-6">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{project.name}</h1>
            </div>
            {keys.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                No API keys for this project. Create one with the CLI:{' '}
                <code className="font-mono text-xs">holocron keys create --project {project.projectId}</code>
              </div>
            ) : (
              <Frame className="w-full">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Name</TableHead>
                      <TableHead>Key</TableHead>
                      <TableHead>Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {keys.map((key: { id: string; name: string; prefix: string; projectId: string; createdAt: number }) => (
                      <TableRow key={key.id}>
                        <TableCell>
                          <span className="text-sm font-medium">{key.name}</span>
                        </TableCell>
                        <TableCell>
                          <span className="font-mono text-xs text-muted-foreground">holo_{key.prefix}...</span>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs text-muted-foreground">
                            {new Date(key.createdAt).toLocaleDateString()}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Frame>
            )}
          </div>
        </main>
      </>
    )
  })

  // ── Coming soon tabs ───────────────────────────────────────────────

  .loader('/dashboard/projects/:projectId/assistant', async ({ request, params }) => {
    const session = await requireSession(request)
    const db = getDb()
    const membership = await db.query.orgMember.findFirst({ where: { userId: session.userId } })
    if (!membership) throw redirect('/dashboard')
    const project = await db.query.project.findFirst({ where: { projectId: params.projectId, orgId: membership.orgId } })
    if (!project) throw redirect('/dashboard')
    return { project }
  })

  .page('/dashboard/projects/:projectId/assistant', async ({ loaderData }) => {
    const { project } = loaderData
    return (
      <>
        <ProjectTabBar projectId={project.projectId} currentTab="assistant" />
        <div className="border-t border-border" />
        <ComingSoon title="AI Assistant" />
      </>
    )
  })

  .loader('/dashboard/projects/:projectId/analytics', async ({ request, params }) => {
    const session = await requireSession(request)
    const db = getDb()
    const membership = await db.query.orgMember.findFirst({ where: { userId: session.userId } })
    if (!membership) throw redirect('/dashboard')
    const project = await db.query.project.findFirst({ where: { projectId: params.projectId, orgId: membership.orgId } })
    if (!project) throw redirect('/dashboard')
    return { project }
  })

  .page('/dashboard/projects/:projectId/analytics', async ({ loaderData }) => {
    const { project } = loaderData
    return (
      <>
        <ProjectTabBar projectId={project.projectId} currentTab="analytics" />
        <div className="border-t border-border" />
        <ComingSoon title="Analytics" />
      </>
    )
  })

  .loader('/dashboard/projects/:projectId/settings', async ({ request, params }) => {
    const session = await requireSession(request)
    const db = getDb()
    const membership = await db.query.orgMember.findFirst({ where: { userId: session.userId } })
    if (!membership) throw redirect('/dashboard')
    const project = await db.query.project.findFirst({ where: { projectId: params.projectId, orgId: membership.orgId } })
    if (!project) throw redirect('/dashboard')
    return { project }
  })

  .page('/dashboard/projects/:projectId/settings', async ({ loaderData }) => {
    const { project } = loaderData
    return (
      <>
        <ProjectTabBar projectId={project.projectId} currentTab="settings" />
        <div className="border-t border-border" />
        <ComingSoon title="Settings" />
      </>
    )
  })

  // ── Deploy flow ─────────────────────────────────────────────────────

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
        <main className="flex-1 p-4 sm:p-6 overflow-x-hidden overflow-y-auto min-w-0">
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
        </main>
      )
    },
  })
