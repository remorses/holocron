// Shared dashboard UI components: GridDot, Sidebar, TabBar, MembersTable.
// Styled to match Sigillo's layout — decorative border dots, left sidebar
// with org switcher + user dropdown, horizontal tab bar with underline.

'use client'

import './strada-client.ts'
import { useState, useEffect } from 'react'
import { Link, useLoaderData } from 'spiceflow/react'
import {
  ArrowRightIcon,
  BuildingIcon,
  CheckIcon,
  ChevronsUpDownIcon,
  CopyIcon,
  FolderIcon,
  FolderOpenIcon,
  GlobeIcon,
  KeyIcon,
  LinkIcon,
  LoaderIcon,
  LogOutIcon,
  MonitorIcon,
  MoonIcon,
  PlusIcon,
  RefreshCwIcon,
  SunIcon,
  Trash2Icon,
  UserPlusIcon,
} from 'lucide-react'
import { createAuthClient } from 'better-auth/react'
import { cn, formatTime } from './lib/utils.ts'
import { Button } from './components/ui/button.tsx'
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPopup,
  DialogTitle,
} from './components/ui/dialog.tsx'
import { Frame } from './components/ui/frame.tsx'
import { Input, NativeSelect } from './components/ui/input.tsx'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuPopup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from './components/ui/dropdown-menu.tsx'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './components/ui/table.tsx'
import { acceptInviteAction, createApiKeyAction, createInviteAction, createOrgAction, updateProjectNameAction, deleteProjectAction, startGscOAuthAction, completeGscOAuthAction, disconnectGscAction, listGscSitesAction, selectGscSiteAction, addDomainAction, refreshDomainStatusAction, removeDomainAction } from './dashboard-actions.ts'
import type { DomainInfo } from './dashboard-actions.ts'
import { openBillingPortal, startCheckout } from './actions.tsx'
import type { dashboardApp } from './dashboard.tsx'

type DashboardApp = typeof dashboardApp

const authClient = createAuthClient()

// ── GridDot ─────────────────────────────────────────────────────────
// Decorative dot placed at border intersections. Must be inside a
// relative container. Outer circle masks the border crossing with the
// page bg, inner dot marks the joint.

const gridDotPosition = {
  tl: 'top-0 left-0 -translate-x-1/2 -translate-y-1/2',
  tr: 'top-0 right-0 translate-x-1/2 -translate-y-1/2',
  bl: 'bottom-0 left-0 -translate-x-1/2 translate-y-1/2',
  br: 'bottom-0 right-0 translate-x-1/2 translate-y-1/2',
} as const

export function GridDot({ position }: { position: keyof typeof gridDotPosition }) {
  return (
    <div
      aria-hidden
      className={cn(
        'absolute z-20 size-5 rounded-full bg-background pointer-events-none',
        'after:content-[""] after:block after:size-[2px] after:rounded-full after:bg-foreground/40 after:m-auto',
        'flex items-center justify-center',
        gridDotPosition[position],
      )}
    />
  )
}

// ── Upgrade Banner ──────────────────────────────────────────────────

export function UpgradeBanner({ projectId, isBillingPage }: { projectId: string | null; isBillingPage?: boolean }) {
  const { hasSubscription } = useLoaderData<DashboardApp, '/dashboard/*'>('/dashboard/*')

  if (!projectId || hasSubscription !== false) return null

  return (
    <div className="sticky top-0 border-b border-primary/20 bg-primary/5">
    <div className="mx-auto flex max-w-(--content-max-width) items-center justify-between gap-4 px-6 py-2.5">
      <div className="flex items-center gap-2 text-sm">
        <span className="font-medium text-primary">Ship docs faster with Pro</span>
        <span className="hidden sm:inline text-muted-foreground">
          — AI chat assistant and unlimited preview deployments
        </span>
      </div>
        <Link
          href={isBillingPage ? undefined : `/dashboard/projects/${projectId}/billing`}
          className={cn('inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground no-underline hover:bg-primary/90 transition-colors shrink-0', isBillingPage && 'invisible pointer-events-none')}
        >
          Subscribe
          <ArrowRightIcon className="size-3" />
        </Link>
    </div>
    </div>
  )
}

// ── Theme toggle ────────────────────────────────────────────────────

// Blocking script that runs before first paint to prevent flash of wrong theme.
// Reads localStorage.theme; falls back to system preference (prefers-color-scheme).
// Also registers a matchMedia listener so "system" mode reacts to OS changes.
export const DASHBOARD_THEME_SCRIPT = `(function(){
  var d=document.documentElement;
  var t=localStorage.getItem("theme");
  var dark;
  if(t==="dark"){dark=true}
  else if(t==="light"){dark=false}
  else{dark=window.matchMedia("(prefers-color-scheme:dark)").matches}
  if(dark)d.classList.add("dark");else d.classList.remove("dark");
  window.matchMedia("(prefers-color-scheme:dark)").addEventListener("change",function(e){
    if(!localStorage.getItem("theme")){
      if(e.matches)d.classList.add("dark");else d.classList.remove("dark")
    }
  })
})()`

function setTheme(theme: 'light' | 'dark' | 'system') {
  if (theme === 'system') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    if (prefersDark) document.documentElement.classList.add('dark')
    else document.documentElement.classList.remove('dark')
    localStorage.removeItem('theme')
  } else if (theme === 'dark') {
    document.documentElement.classList.add('dark')
    localStorage.setItem('theme', 'dark')
  } else {
    document.documentElement.classList.remove('dark')
    localStorage.setItem('theme', 'light')
  }
}

// ── Sidebar ─────────────────────────────────────────────────────────

export function DashboardSidebar({
  currentProjectId,
}: {
  currentProjectId: string | null
}) {
  const { projects, orgs, org, user } = useLoaderData<DashboardApp, '/dashboard/*'>('/dashboard/*')
  const [createOrgOpen, setCreateOrgOpen] = useState(false)
  const userInitials = user.name
    ? user.name
        .split(' ')
        .map((w) => w[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : '?'

  return (
    <aside className="hidden md:flex flex-col w-64 self-stretch min-h-0 border-r border-sidebar-border bg-background text-foreground p-6">
      {/* ── Org switcher ──────────────────────────────────────── */}
      <DropdownMenu>
        <DropdownMenuTrigger
          className={cn(
            'flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm transition-colors hover:bg-sidebar-accent data-[popup-open]:bg-sidebar-accent',
          )}
        >
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <BuildingIcon className="size-4" />
          </div>
          <div className="grid flex-1 text-left leading-tight min-w-0">
            <span className="truncate font-medium text-sm">
              {org?.name || 'No organization'}
            </span>
          </div>
          <ChevronsUpDownIcon className="ml-auto size-4 shrink-0 text-muted-foreground" />
        </DropdownMenuTrigger>

        <DropdownMenuPopup side="bottom" align="start" sideOffset={4}>
          <DropdownMenuLabel>Organizations</DropdownMenuLabel>
          {orgs.map((o) => (
            <DropdownMenuItem
              key={o.id}
              onClick={() => {
                const href = o.firstProjectId
                  ? `/dashboard/projects/${o.firstProjectId}`
                  : `/dashboard?orgId=${o.id}`
                window.location.href = href
              }}
            >
              <div className="flex size-6 items-center justify-center rounded-md border">
                <BuildingIcon className="size-3.5 shrink-0" />
              </div>
              <span className="flex-1 truncate">{o.name}</span>
              {o.id === org?.id && (
                <CheckIcon className="size-3.5 text-muted-foreground" />
              )}
            </DropdownMenuItem>
          ))}
          {orgs.length === 0 && (
            <div className="px-2 py-1.5 text-xs text-muted-foreground">
              No organization yet
            </div>
          )}
          <DropdownMenuSeparator />
          <CreateOrgMenuItem onClick={() => setCreateOrgOpen(true)} />
        </DropdownMenuPopup>
      </DropdownMenu>
      <CreateOrgDialog open={createOrgOpen} onOpenChange={setCreateOrgOpen} />

      {/* ── Projects ──────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto pt-4">
        <div className="mb-1 pl-2">
          <span className="text-xs font-medium text-muted-foreground">Projects</span>
        </div>

        <nav className="flex flex-col gap-0.5">
          {projects.map((project) => {
            const isActive = currentProjectId === project.projectId
            return (
              <Link
                key={project.projectId}
                href={`/dashboard/projects/${project.projectId}`}
                className={cn(
                  'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-sidebar-accent no-underline',
                  isActive && 'bg-sidebar-accent text-primary font-medium',
                )}
              >
                {isActive ? (
                  <FolderOpenIcon className="size-4 shrink-0" />
                ) : (
                  <FolderIcon className="size-4 shrink-0 opacity-60" />
                )}
                {project.name}
              </Link>
            )
          })}
          <NewProjectSidebarItem />
        </nav>
      </div>

      {/* ── User footer with dropdown ─────────────────────────── */}
      <div className="border-t border-sidebar-border pt-4">
        <DropdownMenu>
          <DropdownMenuTrigger
            className={cn(
              'flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm transition-colors hover:bg-sidebar-accent data-[popup-open]:bg-sidebar-accent',
            )}
          >
            {user.image ? (
              <img src={user.image} alt="" className="size-8 shrink-0 rounded-full object-cover" />
            ) : (
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground font-medium text-xs">
                {userInitials}
              </div>
            )}
            <div className="grid flex-1 text-left leading-tight min-w-0">
              <span className="truncate font-medium text-sm">{user.name || 'User'}</span>
              <span className="truncate text-xs text-muted-foreground">{user.email || ''}</span>
            </div>
            <ChevronsUpDownIcon className="ml-auto size-4 shrink-0 text-muted-foreground" />
          </DropdownMenuTrigger>

          <DropdownMenuPopup side="top" align="start" sideOffset={4}>
            {/* User info header */}
            <div className="flex items-center gap-2 px-2 py-1.5 text-sm">
              {user.image ? (
                <img src={user.image} alt="" className="size-8 shrink-0 rounded-full object-cover" />
              ) : (
                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground font-medium text-xs">
                  {userInitials}
                </div>
              )}
              <div className="grid flex-1 leading-tight min-w-0">
                <span className="truncate font-medium text-sm">{user.name || 'User'}</span>
                <span className="truncate text-xs text-muted-foreground">{user.email || ''}</span>
              </div>
            </div>
            <DropdownMenuSeparator />
            {/* Theme options */}
            <DropdownMenuLabel>Theme</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => setTheme('light')}>
              <SunIcon className="size-4 text-muted-foreground" />
              Light
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme('dark')}>
              <MoonIcon className="size-4 text-muted-foreground" />
              Dark
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme('system')}>
              <MonitorIcon className="size-4 text-muted-foreground" />
              System
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={async () => {
                await authClient.signOut()
                window.location.href = '/login'
              }}
            >
              <LogOutIcon className="size-4 text-muted-foreground" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuPopup>
        </DropdownMenu>
      </div>
    </aside>
  )
}

// ── Create Organization ─────────────────────────────────────────────

function CreateOrgMenuItem({ onClick }: { onClick: () => void }) {
  return (
    <DropdownMenuItem onClick={onClick}>
      <div className="flex size-6 items-center justify-center rounded-md border bg-transparent">
        <PlusIcon className="size-4" />
      </div>
      <span className="text-muted-foreground font-medium">Add organization</span>
    </DropdownMenuItem>
  )
}

function CreateOrgDialog({ open, onOpenChange }: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setName('')
      setError(null)
    }
    onOpenChange(nextOpen)
  }

  async function handleCreate() {
    setLoading(true)
    setError(null)
    try {
      const result = await createOrgAction({ name })
      window.location.href = `/dashboard?orgId=${result.orgId}`
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create organization')
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogPopup>
        <DialogHeader>
          <DialogTitle>New Organization</DialogTitle>
          <DialogDescription>
            Create a new organization. You will be its admin.
          </DialogDescription>
        </DialogHeader>
        <div className="px-6 pb-2">
          {error && (
            <div className="text-sm text-destructive mb-3">{error}</div>
          )}
          <div className="flex flex-col gap-3">
            <Input
              placeholder="Organization name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && name.trim()) {
                  e.preventDefault()
                  handleCreate()
                }
              }}
              autoFocus
            />
          </div>
          <DialogFooter variant="bare" className="mt-4">
            <DialogClose render={<Button variant="outline" />}>
              Cancel
            </DialogClose>
            <Button onClick={handleCreate} loading={loading} disabled={!name.trim()}>
              Create organization
            </Button>
          </DialogFooter>
        </div>
      </DialogPopup>
    </Dialog>
  )
}

// ── Create Project ──────────────────────────────────────────────────

function NewProjectSidebarItem() {
  return (
    <Link
      href="/dashboard/deploy"
      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground no-underline"
    >
      <PlusIcon className="size-4 shrink-0 opacity-60" />
      New site
    </Link>
  )
}

// ── TabBar ───────────────────────────────────────────────────────────

type Tab = {
  label: string
  href: string
  active: boolean
  comingSoon?: boolean
}

export function ProjectTabBar({ projectId, currentTab }: { projectId: string; currentTab: string }) {
  const base = `/dashboard/projects/${projectId}`
  const tabs: Tab[] = [
    { label: 'Overview', href: base, active: currentTab === 'overview' },
    { label: 'API Keys', href: `${base}/keys`, active: currentTab === 'keys' },
    { label: 'Billing', href: `${base}/billing`, active: currentTab === 'billing' },
    { label: 'Members', href: `${base}/members`, active: currentTab === 'members' },
    { label: 'Settings', href: `${base}/settings`, active: currentTab === 'settings' },
    { label: 'Assistant', href: `${base}/assistant`, active: currentTab === 'assistant', comingSoon: true },
    { label: 'Analytics', href: `${base}/analytics`, active: currentTab === 'analytics', comingSoon: true },
  ]

  return (
    <div className="relative max-w-(--content-max-width) mx-auto w-full border-x border-border">
      <GridDot position="tl" />
      <GridDot position="tr" />
      <GridDot position="bl" />
      <GridDot position="br" />
      <div className="flex h-10 items-stretch gap-4 sm:gap-6 px-4 sm:px-6 overflow-x-auto scrollbar-hide">
        {tabs.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              'relative flex items-center shrink-0 whitespace-nowrap text-sm no-underline transition-colors duration-150',
              tab.active
                ? 'font-medium text-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {tab.label}
            {tab.comingSoon && (
              <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground leading-none">
                Soon
              </span>
            )}
            {tab.active && (
              <div className="absolute bottom-0 left-0 w-full h-[2.5px] bg-primary rounded-sm" />
            )}
          </Link>
        ))}
      </div>
    </div>
  )
}

// ── Members table ───────────────────────────────────────────────────

export function MembersTable() {
  const { members } = useLoaderData<DashboardApp, '/dashboard/projects/:projectId/members'>('/dashboard/projects/:projectId/members')
  return (
    <Frame className="w-full">
      <Table className="table-fixed">
        <colgroup>
          <col className="w-1/4" />
          <col className="w-1/3" />
          <col className="w-36" />
          <col className="w-32" />
        </colgroup>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Joined</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {members.map((member) => (
            <TableRow key={member.id}>
              <TableCell>
                <div className="flex items-center gap-2">
                  {member.user?.image ? (
                    <img src={member.user.image} alt="" className="size-6 rounded-full object-cover" />
                  ) : (
                    <div className="size-6 rounded-full bg-muted flex items-center justify-center text-xs font-medium text-muted-foreground">
                      {(member.user?.name || member.user?.email || '?').charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span className="text-sm font-medium">{member.user?.name || '—'}</span>
                </div>
              </TableCell>
              <TableCell>
                <span className="text-sm text-muted-foreground">{member.user?.email || '—'}</span>
              </TableCell>
              <TableCell>
                <span className="text-xs font-medium capitalize">{member.role}</span>
              </TableCell>
              <TableCell>
                <span className="text-muted-foreground text-xs tabular-nums">
                  {formatTime(member.createdAt)}
                </span>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Frame>
  )
}

// ── Coming Soon placeholder ──────────────────────────────────────────

export function ComingSoon({ title }: { title: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="text-lg font-medium text-muted-foreground">{title}</div>
      <div className="mt-2 text-sm text-muted-foreground/60">This feature is coming soon.</div>
    </div>
  )
}

// ── Billing ─────────────────────────────────────────────────────────

export type BillingSubscription = {
  status: string
  interval: 'month' | 'year' | null
  currentPeriodEnd: number | null
  cancelAtPeriodEnd: boolean
}

const PRO_FEATURES = [
  'Hosted AI chat assistant for your docs',
  'Unlimited preview deployments for every branch and PR',
  'Analytics (coming soon)',
]

function FeatureList() {
  return (
    <ul className="flex flex-col gap-2">
      {PRO_FEATURES.map((feature) => (
        <li key={feature} className="flex items-start gap-2 text-sm text-muted-foreground">
          <CheckIcon className="mt-0.5 size-4 shrink-0 text-primary" />
          <span>{feature}</span>
        </li>
      ))}
    </ul>
  )
}

export function BillingPanel({
  projectId,
  subscription,
}: {
  projectId: string
  subscription: BillingSubscription | null
}) {
  if (subscription) {
    const renews = subscription.currentPeriodEnd
      ? new Date(subscription.currentPeriodEnd).toLocaleDateString()
      : null
    return (
      <div className="flex max-w-xl flex-col gap-5 rounded-xl border border-border bg-background p-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h2 className="text-base font-semibold">Holocron Pro</h2>
            <div className="text-sm text-muted-foreground">
              {subscription.interval === 'year' ? 'Billed yearly' : 'Billed monthly'}
              {' · '}
              <span className="capitalize">{subscription.status}</span>
            </div>
          </div>
          <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
            Active
          </span>
        </div>
        <FeatureList />
        {renews && (
          <div className="text-xs text-muted-foreground">
            {subscription.cancelAtPeriodEnd
              ? `Cancels on ${renews}.`
              : `Renews on ${renews}.`}
          </div>
        )}
        <form action={openBillingPortal}>
          <input type="hidden" name="projectId" value={projectId} />
          <Button data-action="manage-subscription" type="submit" variant="outline" loadingText="Opening...">
            Manage subscription
          </Button>
        </form>
      </div>
    )
  }

  return (
    <div className="flex max-w-xl flex-col gap-5 rounded-xl border border-border bg-background p-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-semibold">Holocron Pro</h2>
        <div className="flex items-baseline gap-1">
          <span className="text-3xl font-bold tracking-tight">$99</span>
          <span className="text-sm text-muted-foreground">/ month</span>
        </div>
        <div className="text-xs text-muted-foreground">or $990 / year — 2 months free</div>
      </div>
      <FeatureList />
      <div className="flex flex-col gap-2 sm:flex-row">
        <form action={startCheckout} className="flex-1">
          <input type="hidden" name="projectId" value={projectId} />
          <input type="hidden" name="interval" value="monthly" />
          <Button data-action="subscribe-monthly" type="submit" className="w-full" loadingText="Redirecting...">
            Subscribe monthly
          </Button>
        </form>
        <form action={startCheckout} className="flex-1">
          <input type="hidden" name="projectId" value={projectId} />
          <input type="hidden" name="interval" value="yearly" />
          <Button data-action="subscribe-yearly" type="submit" variant="outline" className="w-full" loadingText="Redirecting...">
            Subscribe yearly
          </Button>
        </form>
      </div>
    </div>
  )
}

// ── Create API Key ──────────────────────────────────────────────────

export function CreateApiKeyButton({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button data-action="create-key" variant="outline" onClick={() => setOpen(true)}>
        <KeyIcon className="size-4" />
        Create API key
      </Button>
      <CreateApiKeyDialog open={open} onOpenChange={setOpen} projectId={projectId} />
    </>
  )
}

function CreateApiKeyDialog({ open, onOpenChange, projectId }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
}) {
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [createdKey, setCreatedKey] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setName('')
      setError(null)
      setCreatedKey(null)
      setCopied(false)
    }
    onOpenChange(nextOpen)
  }

  async function handleCreate() {
    setLoading(true)
    setError(null)
    try {
      const result = await createApiKeyAction({ name, projectId })
      setCreatedKey(result.fullKey)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create API key')
    } finally {
      setLoading(false)
    }
  }

  async function handleCopy() {
    if (!createdKey) return
    await navigator.clipboard.writeText(createdKey)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogPopup>
        <DialogHeader>
          <DialogTitle>Create API key</DialogTitle>
          <DialogDescription>
            {createdKey
              ? 'Copy your API key now. You will not be able to see it again.'
              : 'Give your key a name to help you remember what it is used for.'}
          </DialogDescription>
        </DialogHeader>
        <div className="px-6 pb-2">
          {error && (
            <div className="text-sm text-destructive mb-3">{error}</div>
          )}
          {createdKey ? (
            <div className="flex flex-col gap-3">
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={createdKey}
                  className="w-full font-mono text-xs"
                  onClick={(e) => e.currentTarget.select()}
                />
                <Button variant="outline" size="icon" onClick={handleCopy}>
                  {copied ? <CheckIcon className="size-4" /> : <CopyIcon className="size-4" />}
                </Button>
              </div>
              <div className="text-xs text-muted-foreground">
                Set <code className="font-mono">HOLOCRON_KEY</code> as an env var in your deploy environment.
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <Input
                placeholder="e.g. production deploy"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && name.trim()) {
                    e.preventDefault()
                    handleCreate()
                  }
                }}
                autoFocus
              />
              <Button
                onClick={handleCreate}
                loading={loading}
                disabled={!name.trim()}
                className="w-full"
              >
                Create key
              </Button>
            </div>
          )}
          <DialogFooter variant="bare" className="mt-4">
            <DialogClose render={<Button variant="outline" />}>
              {createdKey ? 'Done' : 'Cancel'}
            </DialogClose>
          </DialogFooter>
        </div>
      </DialogPopup>
    </Dialog>
  )
}

// ── Invite Member (link-based) ──────────────────────────────────────

export function InviteButton({ orgId }: { orgId: string }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button data-action="invite-member" variant="outline" onClick={() => setOpen(true)}>
        <UserPlusIcon className="size-4" />
        Invite member
      </Button>
      <InviteDialog open={open} onOpenChange={setOpen} orgId={orgId} />
    </>
  )
}

function InviteDialog({ open, onOpenChange, orgId }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  orgId: string
}) {
  const [inviteUrl, setInviteUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleGenerate() {
    setLoading(true)
    setError(null)
    try {
      const result = await createInviteAction({ orgId })
      setInviteUrl(`${window.location.origin}/invite/${result.id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate invite link')
    } finally {
      setLoading(false)
    }
  }

  async function handleCopy() {
    if (!inviteUrl) return
    await navigator.clipboard.writeText(inviteUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setInviteUrl(null)
      setCopied(false)
      setError(null)
    }
    onOpenChange(nextOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogPopup>
        <DialogHeader>
          <DialogTitle>Invite member</DialogTitle>
          <DialogDescription>
            Generate a link to invite someone to this organization.
            Anyone with the link can join <strong>all sites</strong> in this organization. The link expires in 7 days.
          </DialogDescription>
        </DialogHeader>
        <div className="px-6 pb-2">
          {error && (
            <div className="text-sm text-destructive mb-3">{error}</div>
          )}
          {inviteUrl ? (
            <div className="flex flex-col gap-3">
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={inviteUrl}
                  className="w-full font-mono text-xs"
                  onClick={(e) => e.currentTarget.select()}
                />
                <Button variant="outline" size="icon" onClick={handleCopy}>
                  {copied ? <CheckIcon className="size-4" /> : <CopyIcon className="size-4" />}
                </Button>
              </div>
              <div className="text-xs text-muted-foreground">
                Share this link with the person you want to invite. They will need to sign in first.
              </div>
            </div>
          ) : (
            <Button onClick={handleGenerate} loading={loading} className="w-full">
              <LinkIcon className="size-4" />
              Generate invite link
            </Button>
          )}
          <DialogFooter variant="bare" className="mt-4">
            <DialogClose render={<Button variant="outline" />}>
              {inviteUrl ? 'Done' : 'Cancel'}
            </DialogClose>
          </DialogFooter>
        </div>
      </DialogPopup>
    </Dialog>
  )
}

// ── Accept Invite Button ────────────────────────────────────────────

export function AcceptInviteButton({ invitationId }: { invitationId: string }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleAccept() {
    setLoading(true)
    setError(null)
    try {
      await acceptInviteAction({ invitationId })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to join organization')
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-center gap-2">
      {error && (
        <div className="text-sm text-destructive">{error}</div>
      )}
      <Button onClick={handleAccept} loading={loading}>
        Join organization
      </Button>
    </div>
  )
}

// ── Grant GitHub Org Access ──────────────────────────────────────────

export function GrantOrgAccessButton({ githubClientId }: { githubClientId: string }) {
  // GitHub doesn't support prompt=consent, so re-triggering the OAuth flow
  // won't show the authorization screen if the app was already authorized.
  // Instead, link directly to the GitHub settings page for this OAuth app
  // where the user can grant/revoke per-org access.
  const settingsUrl = `https://github.com/settings/connections/applications/${githubClientId}`

  return (
    <div>
      <Button data-action="grant-org-access" variant="outline" asChild>
        <a href={settingsUrl} target="_blank" rel="noopener noreferrer">
          <BuildingIcon className="size-4" />
          Grant org access
        </a>
      </Button>
    </div>
  )
}

// ── Settings Form (rename project) ──────────────────────────────────

export function SettingsForm({ projectId, initialName }: { projectId: string; initialName: string }) {
  const [name, setName] = useState(initialName)
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    if (!name.trim()) return
    setLoading(true)
    setError(null)
    setSaved(false)
    try {
      await updateProjectNameAction({ projectId, name: name.trim() })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update name')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium">Site name</label>
      <div className="flex gap-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="My Docs"
          className="max-w-sm"
        />
        <Button data-action="save-project-name" onClick={handleSave} loading={loading} disabled={name.trim() === initialName}>
          {saved ? 'Saved' : 'Save'}
        </Button>
      </div>
      {error && <div className="text-sm text-destructive">{error}</div>}
      <div className="text-xs text-muted-foreground">
        Display name for this site. Also set automatically from the <code className="font-mono font-semibold">name</code> field in docs.json on each deploy.
      </div>
    </div>
  )
}

// ── Delete Project Button ───────────────────────────────────────────

export function DeleteProjectButton({ projectId, projectName }: { projectId: string; projectName: string }) {
  const [confirming, setConfirming] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleDelete() {
    setLoading(true)
    setError(null)
    try {
      await deleteProjectAction({ projectId })
    } catch (e) {
      // redirect throws, so if we get here it's an actual error
      setError(e instanceof Error ? e.message : 'Failed to delete project')
      setLoading(false)
    }
  }

  if (!confirming) {
    return (
      <div>
        <Button data-action="delete-project" variant="destructive" size="sm" onClick={() => setConfirming(true)}>
          Delete this site
        </Button>
      </div>
    )
  }

  const canDelete = confirmText === projectName

  return (
    <div className="flex flex-col gap-3">
      <div className="text-sm text-muted-foreground">
        Type <strong>{projectName}</strong> to confirm deletion. This will permanently remove the site, all deployments, and API keys.
      </div>
      <div className="flex gap-2 items-center">
        <Input
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          placeholder={projectName}
          className="max-w-48"
        />
        <Button variant="destructive" size="sm" onClick={handleDelete} loading={loading} disabled={!canDelete}>
          Confirm delete
        </Button>
        <Button variant="outline" size="sm" onClick={() => { setConfirming(false); setConfirmText('') }}>
          Cancel
        </Button>
      </div>
      {error && <div className="text-sm text-destructive">{error}</div>}
    </div>
  )
}

// ── Google Search Console Connection ────────────────────────────────
// OAuth proxy calls happen server-side (startGscOAuthAction, completeGscOAuthAction)
// to avoid CORS issues and keep Google tokens out of the browser.
// Framer's open-source OAuth proxy worker: https://github.com/framer/plugin-oauth (MIT)
// GSC plugin reference: https://github.com/framer/plugins/tree/main/plugins/google-search-console

const GSC_PENDING_KEY = 'holocron-gsc-pending'

/** Strip GSC prefixes for display: "sc-domain:example.com" → "example.com",
 *  "https://example.com/" → "example.com" */
function displayGscSiteUrl(siteUrl: string): string {
  if (siteUrl.startsWith('sc-domain:')) return siteUrl.slice('sc-domain:'.length)
  try {
    return new URL(siteUrl).hostname
  } catch {
    return siteUrl
  }
}

interface GscConnectionInfo {
  siteUrl: string | null
  googleEmail: string | null
  oauthAppId: string
}

export function ConnectGscButton({ projectId, connection }: {
  projectId: string
  connection: GscConnectionInfo | null
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [connected, setConnected] = useState(!!connection)
  const [siteUrl, setSiteUrl] = useState(connection?.siteUrl || null)
  const [sites, setSites] = useState<Array<{ siteUrl: string; permissionLevel: string }> | null>(null)
  const [loadingSites, setLoadingSites] = useState(false)

  // On mount, check if we're returning from Google consent and need to complete the flow
  useEffect(() => {
    const pending = localStorage.getItem(GSC_PENDING_KEY)
    if (!pending) return

    let parsed: { readKey: string; projectId: string; createdAt: number }
    try {
      parsed = JSON.parse(pending)
    } catch {
      localStorage.removeItem(GSC_PENDING_KEY)
      return
    }

    // Only complete if this is the same project and not expired (5 min)
    if (parsed.projectId !== projectId) return
    if (Date.now() - parsed.createdAt > 5 * 60 * 1000) {
      localStorage.removeItem(GSC_PENDING_KEY)
      return
    }

    completeOAuth(parsed.readKey)
  }, [projectId])

  async function completeOAuth(readKey: string) {
    setLoading(true)
    setError(null)
    try {
      // Server polls the OAuth proxy and stores tokens — they never touch the browser
      const { sites } = await completeGscOAuthAction({ projectId, readKey })

      // Only clear pending key on success
      localStorage.removeItem(GSC_PENDING_KEY)
      setConnected(true)

      if (sites.length === 1) {
        await selectGscSiteAction({ projectId, siteUrl: sites[0]!.siteUrl })
        setSiteUrl(sites[0]!.siteUrl)
      } else if (sites.length > 0) {
        setSites(sites)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to complete connection')
    } finally {
      setLoading(false)
    }
  }

  async function handleConnect() {
    setLoading(true)
    setError(null)
    try {
      // Server calls the OAuth proxy (avoids CORS) and returns the consent URL
      const { url, readKey } = await startGscOAuthAction({ projectId })

      // Store pending auth so we can resume if user navigates away
      localStorage.setItem(GSC_PENDING_KEY, JSON.stringify({
        readKey,
        projectId,
        createdAt: Date.now(),
      }))

      // Open Google consent in a new tab
      window.open(url, '_blank')

      // Server-side poll for tokens while user is in the other tab
      await completeOAuth(readKey)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to connect')
      setLoading(false)
    }
  }

  async function handleDisconnect() {
    setLoading(true)
    setError(null)
    try {
      await disconnectGscAction({ projectId })
      setConnected(false)
      setSiteUrl(null)
      setSites(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to disconnect')
    } finally {
      setLoading(false)
    }
  }

  if (loading && !connected) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        Connecting to Google Search Console...
      </div>
    )
  }

  if (connected) {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2 text-sm">
          <div className={`size-2 rounded-full ${siteUrl ? 'bg-green-500' : 'bg-yellow-500'}`} />
          <span className="text-muted-foreground">
            {siteUrl ? `Connected: ${displayGscSiteUrl(siteUrl)}` : 'Connected, no site selected'}
          </span>
        </div>

        {/* Site selector — shown when sites are loaded or a site is already selected */}
        {(sites && sites.length > 0) || siteUrl ? (
          <div className="flex items-center gap-2">
            <NativeSelect
              value={siteUrl || ''}
              onChange={async (e) => {
                const url = e.target.value
                if (!url) return
                setError(null)
                try {
                  await selectGscSiteAction({ projectId, siteUrl: url })
                  setSiteUrl(url)
                } catch (err) {
                  setError(err instanceof Error ? err.message : 'Failed to select site')
                }
              }}
              className="max-w-xs"
            >
              {!siteUrl && <option value="">Select a property...</option>}
              {(sites || []).map((site) => (
                <option key={site.siteUrl} value={site.siteUrl}>
                  {displayGscSiteUrl(site.siteUrl)}
                </option>
              ))}
              {/* Keep current selection visible even if sites haven't been re-fetched */}
              {siteUrl && !sites?.some(s => s.siteUrl === siteUrl) && (
                <option value={siteUrl}>{displayGscSiteUrl(siteUrl)}</option>
              )}
            </NativeSelect>
            {!sites && (
              <Button variant="outline" size="sm" onClick={async () => {
                setLoadingSites(true)
                setError(null)
                try {
                  const { sites: fetched } = await listGscSitesAction({ projectId })
                  setSites(fetched)
                } catch (e) {
                  setError(e instanceof Error ? e.message : 'Failed to load sites')
                } finally {
                  setLoadingSites(false)
                }
              }} loading={loadingSites}>
                Change
              </Button>
            )}
          </div>
        ) : (
          <div>
            <Button variant="outline" size="sm" onClick={async () => {
              setLoadingSites(true)
              setError(null)
              try {
                const { sites: fetched } = await listGscSitesAction({ projectId })
                setSites(fetched)
              } catch (e) {
                setError(e instanceof Error ? e.message : 'Failed to load sites')
              } finally {
                setLoadingSites(false)
              }
            }} loading={loadingSites}>
              Choose site
            </Button>
          </div>
        )}

        <div>
          <Button variant="outline" size="sm" onClick={handleDisconnect} loading={loading}>
            Disconnect
          </Button>
        </div>
        {error && <div className="text-sm text-destructive">{error}</div>}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <div>
        <Button data-action="connect-gsc" variant="outline" onClick={handleConnect} loading={loading}>
          <LinkIcon className="size-4" />
          Connect Google Search Console
        </Button>
      </div>
      {error && <div className="text-sm text-destructive">{error}</div>}
    </div>
  )
}

// ── Custom Domains ──────────────────────────────────────────────────

export function CustomDomainsSection({ projectId, domains: initialDomains, hasSubscription }: {
  projectId: string
  domains: DomainInfo[]
  hasSubscription: boolean
}) {
  const [domains, setDomains] = useState(initialDomains)
  const [addOpen, setAddOpen] = useState(false)

  function handleDomainAdded(domain: DomainInfo) {
    setDomains((prev) => [domain, ...prev])
  }

  function handleDomainRemoved(domainId: string) {
    setDomains((prev) => prev.filter((d) => d.id !== domainId))
  }

  function handleDomainUpdated(updated: DomainInfo) {
    setDomains((prev) => prev.map((d) => d.id === updated.id ? updated : d))
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="text-sm text-muted-foreground">
        Point your own domain at this site. Requires a Pro subscription.
      </div>

      {!hasSubscription && (
        <div className="text-sm text-yellow-600 bg-yellow-500/10 rounded-lg px-3 py-2">
          Custom domains require a Holocron Pro subscription. Upgrade from the Billing tab.
        </div>
      )}

      <div className="flex gap-2">
        <Button data-action="add-domain" variant="outline" onClick={() => setAddOpen(true)} disabled={!hasSubscription}>
          <GlobeIcon className="size-4" />
          Add domain
        </Button>
      </div>

      <AddDomainDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        projectId={projectId}
        onAdded={handleDomainAdded}
      />

      {domains.length > 0 && (
        <Frame className="w-full">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Domain</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>SSL</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {domains.map((d) => (
                <DomainRow
                  key={d.id}
                  domain={d}
                  projectId={projectId}
                  onUpdated={handleDomainUpdated}
                  onRemoved={handleDomainRemoved}
                />
              ))}
            </TableBody>
          </Table>
        </Frame>
      )}
    </div>
  )
}

function StatusBadge({ status, variant }: { status: string; variant: 'hostname' | 'ssl' }) {
  const isActive = status === 'active'
  const isPending = status === 'pending' || status === 'pending_validation' || status === 'initializing'

  return (
    <span className={cn(
      'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium leading-none',
      isActive && 'bg-green-500/10 text-green-600',
      isPending && 'bg-yellow-500/10 text-yellow-600',
      !isActive && !isPending && 'bg-muted text-muted-foreground',
    )}>
      {status || (variant === 'ssl' ? 'pending' : 'unknown')}
    </span>
  )
}

function DomainRow({ domain, projectId, onUpdated, onRemoved }: {
  domain: DomainInfo
  projectId: string
  onUpdated: (d: DomainInfo) => void
  onRemoved: (id: string) => void
}) {
  const [refreshing, setRefreshing] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleRefresh() {
    setRefreshing(true)
    setError(null)
    try {
      const updated = await refreshDomainStatusAction({ projectId, domainId: domain.id })
      onUpdated(updated)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to refresh')
    } finally {
      setRefreshing(false)
    }
  }

  async function handleRemove() {
    if (!confirm(`Remove ${domain.hostname}? This will stop serving your site on this domain.`)) return
    setRemoving(true)
    setError(null)
    try {
      await removeDomainAction({ projectId, domainId: domain.id })
      onRemoved(domain.id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to remove')
      setRemoving(false)
    }
  }

  return (
    <>
      <TableRow>
        <TableCell>
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-medium">{domain.hostname}</span>
            {domain.status !== 'active' && (
              <span className="text-[11px] text-muted-foreground font-mono">
                CNAME → {domain.cnameTarget}
              </span>
            )}
          </div>
        </TableCell>
        <TableCell>
          <StatusBadge status={domain.status} variant="hostname" />
        </TableCell>
        <TableCell>
          <StatusBadge status={domain.sslStatus || 'pending'} variant="ssl" />
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-1 justify-end">
            <Button variant="ghost" size="icon" onClick={handleRefresh} disabled={refreshing} title="Refresh status">
              {refreshing ? <LoaderIcon className="size-3.5 animate-spin" /> : <RefreshCwIcon className="size-3.5" />}
            </Button>
            <Button variant="ghost" size="icon" onClick={handleRemove} disabled={removing} title="Remove domain">
              <Trash2Icon className="size-3.5 text-destructive" />
            </Button>
          </div>
        </TableCell>
      </TableRow>
      {error && (
        <TableRow>
          <TableCell colSpan={4}>
            <div className="text-xs text-destructive">{error}</div>
          </TableCell>
        </TableRow>
      )}
    </>
  )
}

function AddDomainDialog({ open, onOpenChange, projectId, onAdded }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  onAdded: (domain: DomainInfo) => void
}) {
  const [hostname, setHostname] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [created, setCreated] = useState<DomainInfo | null>(null)

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setHostname('')
      setError(null)
      setCreated(null)
    }
    onOpenChange(nextOpen)
  }

  async function handleAdd() {
    setLoading(true)
    setError(null)
    try {
      const result = await addDomainAction({ projectId, hostname })
      setCreated(result)
      onAdded(result)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add domain')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogPopup>
        <DialogHeader>
          <DialogTitle>{created ? 'Domain added' : 'Add custom domain'}</DialogTitle>
          <DialogDescription>
            {created
              ? 'Configure your DNS to point to Holocron.'
              : 'Enter the domain you want to use for this docs site.'}
          </DialogDescription>
        </DialogHeader>
        <div className="px-6 pb-2">
          {error && (
            <div className="text-sm text-destructive mb-3">{error}</div>
          )}
          {created ? (
            <div className="flex flex-col gap-3">
              <div className="text-sm">
                Add this CNAME record at your DNS provider:
              </div>
              <div className="rounded-lg border border-border bg-muted/50 p-3 font-mono text-xs flex flex-col gap-1">
                <div><span className="text-muted-foreground">Type: </span>CNAME</div>
                <div><span className="text-muted-foreground">Name: </span>{created.hostname}</div>
                <div><span className="text-muted-foreground">Value: </span>{created.cnameTarget}</div>
              </div>
              <div className="text-xs text-muted-foreground">
                SSL certificates are provisioned automatically once DNS is configured.
                Use the refresh button to check status.
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <Input
                placeholder="docs.mycompany.com"
                value={hostname}
                onChange={(e) => setHostname(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && hostname.trim()) {
                    e.preventDefault()
                    handleAdd()
                  }
                }}
                autoFocus
              />
            </div>
          )}
          <DialogFooter variant="bare" className="mt-4">
            <DialogClose render={<Button variant="outline" />}>
              {created ? 'Done' : 'Cancel'}
            </DialogClose>
            {!created && (
              <Button onClick={handleAdd} loading={loading} disabled={!hostname.trim()}>
                Add domain
              </Button>
            )}
          </DialogFooter>
        </div>
      </DialogPopup>
    </Dialog>
  )
}
