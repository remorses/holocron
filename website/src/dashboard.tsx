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

//
// Route handlers stay here; their JSX lives in dashboard-views.tsx, loaded
// with `await import()`. That gives the dashboard its own server chunk, so its
// client components (base-ui, dashboard chat) stay out of docs pages.

import { Spiceflow, redirect } from 'spiceflow'
import { getBaseUrl, getDb, getSession, getProjectSubscription, requireSession } from './db.ts'
import { normalizeAuthRedirectPath } from './auth-redirect.ts'

const loadViews = () => import('./dashboard-views.tsx')

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


// ── Project loaders ─────────────────────────────────────────────────

async function loadProjectOverview({ request, params }: { request: Request; params: { projectId: string } }) {
  const { project, db } = await resolveProjectAccess(request, (db) => db.query.project.findFirst({
    where: { projectId: params.projectId },
    with: {
      deployments: {
        orderBy: { createdAt: 'desc' },
        limit: 20,
        with: { triggeredByUser: true },
      },
    },
  }))

  const activeDomains = await db.query.domain.findMany({
    where: { projectId: params.projectId, status: 'active' },
    columns: { hostname: true },
  })

  return {
    activeDomains: activeDomains.map((d) => d.hostname),
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
}

async function loadMembers({ request, params }: { request: Request; params: { projectId: string } }) {
  const { db, project, orgId } = await resolveProjectAccess(request, (db) => db.query.project.findFirst({
    where: { projectId: params.projectId },
  }))

  const members = await db.query.orgMember.findMany({
    where: { orgId },
    with: { user: true },
  })

  return { project, members, orgId }
}

async function loadKeys({ request, params }: { request: Request; params: { projectId: string } }) {
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
}

async function loadBilling({ request, params }: { request: Request; params: { projectId: string } }) {
  const { project } = await resolveProjectAccess(request, (db) => db.query.project.findFirst({
    where: { projectId: params.projectId },
  }))
  const subscription = await getProjectSubscription(project.projectId)
  return {
    project,
    subscription: subscription
      ? {
          status: subscription.status,
          interval: subscription.interval,
          currentPeriodEnd: subscription.currentPeriodEnd,
          cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
        }
      : null,
  }
}

async function loadSettings({ request, params }: { request: Request; params: { projectId: string } }) {
  const { env } = await import('cloudflare:workers')
  const { project, db } = await resolveProjectAccess(request, (db) => db.query.project.findFirst({
    where: { projectId: params.projectId },
  }))
  const [gscConnection, domains, subscription] = await Promise.all([
    db.query.gscConnection.findFirst({
      where: { projectId: params.projectId },
      columns: { siteUrl: true, googleEmail: true, oauthAppId: true },
    }),
    db.query.domain.findMany({
      where: { projectId: params.projectId },
      orderBy: { createdAt: 'desc' },
    }),
    getProjectSubscription(params.projectId),
  ])
  const { CNAME_TARGET } = await import('./lib/cloudflare.ts')
  return {
    project,
    githubClientId: env.GITHUB_CLIENT_ID,
    gscConnection: gscConnection || null,
    domains: domains.map((d) => ({
      id: d.id,
      hostname: d.hostname,
      status: d.status,
      sslStatus: d.sslStatus ?? null,
      cnameTarget: CNAME_TARGET,
      createdAt: d.createdAt,
    })),
    hasSubscription: !!subscription,
  }
}

async function loadProject({ request, params }: { request: Request; params: { projectId: string } }) {
  const { project } = await resolveProjectAccess(request, (db) => db.query.project.findFirst({
    where: { projectId: params.projectId },
  }))
  return { project }
}

export type ProjectOverviewData = Awaited<ReturnType<typeof loadProjectOverview>>
export type MembersData = Awaited<ReturnType<typeof loadMembers>>
export type KeysData = Awaited<ReturnType<typeof loadKeys>>
export type BillingData = Awaited<ReturnType<typeof loadBilling>>
export type SettingsData = Awaited<ReturnType<typeof loadSettings>>

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

    // Check subscription status for the current project (used by upgrade banner)
    const hasSubscription = projectId
      ? !!(await getProjectSubscription(projectId))
      : null

    return {
      user: session.user,
      orgs,
      org: selectedMembership?.org ?? null,
      orgId: selectedMembership?.org?.id ?? null,
      projects,
      hasSubscription,
    }
  })

  // Shell layout: navbar + sidebar + main content area
  .layout('/dashboard/*', async ({ children, request }) => {
    const { DashboardLayout } = await loadViews()
    // Extract projectId from the URL path since layout runs before sub-loaders
    const projectId = request.parsedUrl.pathname.match(/^\/dashboard\/projects\/([^/]+)/)?.[1] ?? null
    return (
      <DashboardLayout
        projectId={projectId}
        isBillingPage={request.parsedUrl.pathname.endsWith('/billing')}
        chatDomain={new URL(getBaseUrl()).host}
      >
        {children}
      </DashboardLayout>
    )
  })

  // ── Dashboard index → redirect to first project ────────────────────

  .page('/dashboard', async ({ loaderData }) => {
    const firstProject = loaderData.projects[0]
    if (firstProject) {
      throw redirect(`/dashboard/projects/${firstProject.projectId}`)
    }
    const { DashboardSetupPanel } = await loadViews()
    return (
      <div className="px-6">
        <DashboardSetupPanel mode="create" />
      </div>
    )
  })

  // ── Project tabs ───────────────────────────────────────────────────

  .loader('/dashboard/projects/:projectId', loadProjectOverview)
  .page('/dashboard/projects/:projectId', async ({ loaderData }) => {
    const { ProjectOverviewView } = await loadViews()
    return <ProjectOverviewView loaderData={loaderData} />
  })

  .loader('/dashboard/projects/:projectId/members', loadMembers)
  .page('/dashboard/projects/:projectId/members', async ({ loaderData }) => {
    const { MembersView } = await loadViews()
    return <MembersView loaderData={loaderData} />
  })

  .loader('/dashboard/projects/:projectId/keys', loadKeys)
  .page('/dashboard/projects/:projectId/keys', async ({ loaderData }) => {
    const { KeysView } = await loadViews()
    return <KeysView loaderData={loaderData} />
  })

  .loader('/dashboard/projects/:projectId/billing', loadBilling)
  .page('/dashboard/projects/:projectId/billing', async ({ loaderData }) => {
    const { BillingView } = await loadViews()
    return <BillingView loaderData={loaderData} />
  })

  .loader('/dashboard/projects/:projectId/settings', loadSettings)
  .page('/dashboard/projects/:projectId/settings', async ({ loaderData }) => {
    const { SettingsView } = await loadViews()
    return <SettingsView loaderData={loaderData} />
  })

  // ── Coming soon tabs ───────────────────────────────────────────────

  .loader('/dashboard/projects/:projectId/assistant', loadProject)
  .page('/dashboard/projects/:projectId/assistant', async ({ loaderData }) => {
    const { ComingSoonView } = await loadViews()
    return <ComingSoonView projectId={loaderData.project.projectId} tab="assistant" title="AI Assistant" />
  })

  .loader('/dashboard/projects/:projectId/analytics', loadProject)
  .page('/dashboard/projects/:projectId/analytics', async ({ loaderData }) => {
    const { ComingSoonView } = await loadViews()
    return <ComingSoonView projectId={loaderData.project.projectId} tab="analytics" title="Analytics" />
  })

  // ── Deploy flow ─────────────────────────────────────────────────────

  .page('/dashboard/deploy', async () => {
    const { DeployView } = await loadViews()
    return <DeployView />
  })

  // ── Invite accept page (standalone, no dashboard layout) ──────────

  .page('/invite/:id', async ({ params, request }) => {
    const { InvalidInviteView, InviteView } = await loadViews()
    const db = getDb()
    const invite = await db.query.orgInvitation.findFirst({
      where: { id: params.id },
      with: { org: true, creator: true },
    })

    if (!invite || invite.expiresAt < Date.now()) {
      return <InvalidInviteView />
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

    return <InviteView invitationId={params.id} orgName={invite.org!.name} creatorName={invite.creator!.name} />
  })
