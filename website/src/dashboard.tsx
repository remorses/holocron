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
//   /dashboard/projects/:projectId/keys        → API keys table
//   /dashboard/deploy                    → create project flow

import { Spiceflow, redirect } from 'spiceflow'
import { Link, router } from 'spiceflow/react'
import { getDb, getSession, requireSession } from './db.ts'
import * as schema from 'db/schema'
import { normalizeAuthRedirectPath } from './auth-redirect.ts'
import { cn, timeAgo } from './lib/utils.ts'
import { Button } from './components/ui/button.tsx'
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
  AcceptInviteButton,
  CreateApiKeyButton,
  CreateProjectButton,
  InviteButton,
} from './dashboard-components.tsx'

const TEMPLATE_REPO_URL = 'https://github.com/remorses/holocron-template'
const CLI_CREATE_COMMAND = 'npx -y @holocron.so/cli create'

/** Resolve project + verify the caller is a member of the project's org.
 *  All project page loaders must use this instead of looking up membership first. */
type DashboardDb = ReturnType<typeof getDb>

async function resolveProjectAccess<Project extends { orgId: string }>(
  request: Request,
  loadProject: (db: DashboardDb) => Promise<Project | null | undefined>,
) {
  const session = await requireSession(request)
  const db = getDb()

  const project = await loadProject(db)
  if (!project) throw redirect('/dashboard')

  const membership = await db.query.orgMember.findFirst({
    where: { userId: session.userId, orgId: project.orgId },
  })
  if (!membership) throw redirect('/dashboard')

  return { session, db, project, membership, orgId: project.orgId }
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
    // Load all org memberships so the org switcher can list them
    const memberships = await db.query.orgMember.findMany({
      where: { userId: session.userId },
      with: { org: { with: { projects: true } } },
    })

    const orgs = memberships
      .filter((m) => m.org)
      .map((m) => ({
        id: m.org!.id,
        name: m.org!.name,
        role: m.role,
        firstProjectId: m.org!.projects.slice().sort((a, b) => b.updatedAt - a.updatedAt)[0]?.projectId ?? null,
      }))

    // Derive selected org from the current URL: projectId in path or orgId in query
    const projectId = request.parsedUrl.pathname.match(/^\/dashboard\/projects\/([^/]+)/)?.[1]
    const requestedOrgId = new URL(request.url).searchParams.get('orgId')

    let selectedMembership = projectId
      ? memberships.find((m) => m.org?.projects.some((p) => p.projectId === projectId))
      : memberships.find((m) => m.orgId === requestedOrgId)
    if (!selectedMembership) selectedMembership = memberships[0]

    const projects = (selectedMembership?.org?.projects ?? [])
      .slice()
      .sort((a, b) => b.updatedAt - a.updatedAt)

    return {
      user: session.user,
      orgs,
      org: selectedMembership?.org ?? null,
      orgId: selectedMembership?.org?.id ?? null,
      projects,
    }
  })

  // Shell layout: navbar + sidebar + main content area
  .layout('/dashboard/*', async ({ children, request }) => {
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
            <Link href={router.href('/dashboard')} className="no-underline flex items-center shrink-0">
              <HolocronLogo />
            </Link>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <a href="/" className="hover:text-foreground no-underline">Docs</a>
              <a href="https://github.com/remorses/holocron" target="_blank" rel="noopener noreferrer" className="hover:text-foreground no-underline">GitHub</a>
            </div>
          </div>
        </header>

        {/* Content area with sidebar */}
        <div className="isolate grow relative flex max-w-(--content-max-width) mx-auto w-full border-x border-border">
          <GridDot position="tl" />
          <GridDot position="tr" />
          <DashboardSidebar currentProjectId={projectId} />
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
            <div className="mt-4">
              <CreateProjectButton />
            </div>
          </>
        ) : (
          <>
            <div className="text-lg font-medium">No projects yet</div>
            <div className="mt-1 text-sm text-muted-foreground">Deploy your first docs site to see it here.</div>
            <div className="mt-4">
              <CreateProjectButton />
            </div>
          </>
        )}
      </div>
    )
  })

  // ── Project overview tab ───────────────────────────────────────────

  .loader('/dashboard/projects/:projectId', async ({ request, params }) => {
    const { project } = await resolveProjectAccess(request, (db) => db.query.project.findFirst({
      where: { projectId: params.projectId },
      with: {
        deployments: {
          orderBy: { createdAt: 'desc' },
          limit: 20,
          with: { triggeredByUser: true },
        },
      },
    }))

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
    const hasDeployments = project.deployments.length > 0

    const siteUrl = project.subdomain
      ? `https://${project.subdomain}-site.holocron.so`
      : null

    return (
      <>
        <ProjectTabBar projectId={project.projectId} currentTab="overview" />
        <div className="border-t border-border" />
        <main className="flex-1 p-4 sm:p-6 overflow-x-hidden overflow-y-auto min-w-0">
          {!hasDeployments ? (
            // Setup UI: shown when the project has no deployments yet
            <div className="flex flex-col items-center gap-10 py-16">
              <DeployPoller />
              <div className="flex max-w-lg flex-col items-center gap-8 text-center">
                <div className="flex flex-col gap-2">
                  <h1 className="text-2xl font-semibold">Deploy your docs site</h1>
                  <div className="text-sm text-muted-foreground">
                    This project has no deployments yet. Deploy with an API key from
                    the <strong>Keys</strong> tab, or create a new GitHub-linked project.
                  </div>
                </div>

                <Button asChild>
                  <a href={`${TEMPLATE_REPO_URL}/generate`} target="_blank" rel="noopener noreferrer">
                    Create GitHub-linked project
                  </a>
                </Button>

                <div className="flex w-full flex-col gap-3">
                  <div className="text-sm text-muted-foreground">Or create locally with the CLI:</div>
                  <div className="w-full rounded-lg border border-border bg-muted/50 text-left">
                    <div className="overflow-x-auto px-5 py-4">
                      <pre className="whitespace-pre font-mono text-sm leading-relaxed">{CLI_CREATE_COMMAND}</pre>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground leading-relaxed">
                    The CLI logs in, creates the Holocron project, and writes a deploy key locally.
                  </div>
                </div>
              </div>
            </div>
          ) : (
            // Normal overview: project info + deployments table
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
                                  className="text-xs text-primary hover:underline font-mono truncate max-w-80 block"
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
              </section>
            </div>
          )}
        </main>
      </>
    )
  })

  // ── Members tab ────────────────────────────────────────────────────

  .loader('/dashboard/projects/:projectId/members', async ({ request, params }) => {
    const { db, project, orgId } = await resolveProjectAccess(request, (db) => db.query.project.findFirst({
      where: { projectId: params.projectId },
    }))

    const members = await db.query.orgMember.findMany({
      where: { orgId },
      with: { user: true },
    })

    return { project, members, orgId }
  })

  .page('/dashboard/projects/:projectId/members', async ({ loaderData }) => {
    const { project, members, orgId } = loaderData

    return (
      <>
        <ProjectTabBar projectId={project.projectId} currentTab="members" />
        <div className="border-t border-border" />
        <main className="flex-1 p-4 sm:p-6 overflow-x-hidden overflow-y-auto min-w-0">
          <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold tracking-tight">{project.name}</h1>
              <InviteButton orgId={orgId} />
            </div>
            <MembersTable />
          </div>
        </main>
      </>
    )
  })

  // ── API Keys tab ────────────────────────────────────────────────────

  .loader('/dashboard/projects/:projectId/keys', async ({ request, params }) => {
    const { project } = await resolveProjectAccess(request, (db) => db.query.project.findFirst({
      where: { projectId: params.projectId },
      with: { keys: true },
    }))

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
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold tracking-tight">{project.name}</h1>
              <CreateApiKeyButton projectId={project.projectId} />
            </div>
            {keys.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                No API keys yet. Create one to deploy from CI or the CLI.
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
    const { project } = await resolveProjectAccess(request, (db) => db.query.project.findFirst({
      where: { projectId: params.projectId },
    }))
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
    const { project } = await resolveProjectAccess(request, (db) => db.query.project.findFirst({
      where: { projectId: params.projectId },
    }))
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

  // ── Deploy flow ─────────────────────────────────────────────────────

  .page('/dashboard/deploy', async () => {
    return (
      <main className="flex-1 p-4 sm:p-6 overflow-x-hidden overflow-y-auto min-w-0">
        <div className="mx-auto flex max-w-2xl flex-col gap-8 py-16">
          <div className="flex flex-col gap-2 text-center">
            <h1 className="text-2xl font-semibold">Create a docs project</h1>
            <div className="text-sm text-muted-foreground">
              Projects are created by your first deploy. Start from the GitHub template,
              or create a local site with the CLI.
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-4 rounded-xl border border-border bg-background p-5">
              <div className="flex flex-col gap-1">
                <h2 className="text-sm font-semibold">GitHub template</h2>
                <div className="text-sm text-muted-foreground">
                  Create a repository from the template. GitHub Actions deploys it and
                  Holocron links the project from verified GitHub OIDC claims.
                </div>
              </div>
              <Button asChild>
                <a href={`${TEMPLATE_REPO_URL}/generate`} target="_blank" rel="noopener noreferrer">
                  Create from GitHub
                </a>
              </Button>
            </div>

            <div className="flex flex-col gap-4 rounded-xl border border-border bg-background p-5">
              <div className="flex flex-col gap-1">
                <h2 className="text-sm font-semibold">Local CLI</h2>
                <div className="text-sm text-muted-foreground">
                  Run the create command. The CLI logs in, creates the project, and
                  writes the deploy key into the generated site.
                </div>
              </div>
              <div className="rounded-lg border border-border bg-muted/50 text-left">
                <div className="overflow-x-auto px-4 py-3">
                  <pre className="whitespace-pre font-mono text-sm leading-relaxed">{CLI_CREATE_COMMAND}</pre>
                </div>
              </div>
            </div>
          </div>

          <div className="text-center text-xs text-muted-foreground">
            After the first deployment finishes, refresh the dashboard and the project will appear in the sidebar.
          </div>
        </div>
      </main>
    )
  })

  // ── Invite accept page (standalone, no dashboard layout) ──────────

  .page('/invite/:id', async ({ params, request }) => {
    const db = getDb()
    const invite = await db.query.orgInvitation.findFirst({
      where: { id: params.id },
      with: { org: true, creator: true },
    })

    if (!invite || invite.expiresAt < Date.now()) {
      return (
        <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
          <div className="text-center max-w-sm">
            <h1 className="text-2xl font-bold tracking-tight mb-2">Invalid Invitation</h1>
            <div className="text-muted-foreground text-sm">This invitation link is invalid or has expired.</div>
          </div>
        </div>
      )
    }

    const session = await getSession(request)
    if (!session) {
      const returnTo = `/invite/${encodeURIComponent(params.id)}`
      throw redirect(`/login?callbackURL=${encodeURIComponent(returnTo)}`)
    }

    // Already a member? Go straight to dashboard
    const existing = await db.query.orgMember.findFirst({
      where: { orgId: invite.orgId, userId: session.userId },
    })
    if (existing) throw redirect('/dashboard')

    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <div className="text-center max-w-sm flex flex-col items-center gap-4">
          <h1 className="text-2xl font-bold tracking-tight">Join {invite.org!.name}</h1>
          <div className="text-muted-foreground text-sm">
            <span className="font-medium text-foreground">{invite.creator!.name}</span> invited you to join this organization.
          </div>
          <div className="text-muted-foreground text-xs">
            This will give you access to <strong>all projects</strong> in this organization.
          </div>
          <AcceptInviteButton invitationId={params.id} />
        </div>
      </div>
    )
  })
