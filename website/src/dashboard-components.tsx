// Shared dashboard UI components: GridDot, Sidebar, TabBar, MembersTable.
// Styled to match Sigillo's layout — decorative border dots, left sidebar
// with org switcher + user dropdown, horizontal tab bar with underline.

'use client'

import { Link } from 'spiceflow/react'
import {
  BuildingIcon,
  ChevronsUpDownIcon,
  FolderIcon,
  FolderOpenIcon,
  LogOutIcon,
  MonitorIcon,
  MoonIcon,
  PlusIcon,
  SunIcon,
} from 'lucide-react'
import { createAuthClient } from 'better-auth/react'
import { cn, formatTime } from './lib/utils.ts'
import { Frame } from './components/ui/frame.tsx'
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

// ── Theme toggle ────────────────────────────────────────────────────

function setTheme(theme: 'light' | 'dark' | 'system') {
  if (theme === 'system') {
    document.documentElement.classList.remove('dark')
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    if (prefersDark) document.documentElement.classList.add('dark')
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

type SidebarProject = {
  projectId: string
  name: string
}

type SidebarOrg = {
  id: string
  name: string
}

type SidebarUser = {
  name: string
  email: string
  image?: string | null
}

export function DashboardSidebar({
  projects,
  currentProjectId,
  org,
  user,
}: {
  projects: SidebarProject[]
  currentProjectId: string | null
  org: SidebarOrg | null
  user: SidebarUser
}) {
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
          <DropdownMenuLabel>Organization</DropdownMenuLabel>
          {org && (
            <DropdownMenuItem>
              <div className="flex size-6 items-center justify-center rounded-md border">
                <BuildingIcon className="size-3.5 shrink-0" />
              </div>
              <span className="flex-1 truncate">{org.name}</span>
            </DropdownMenuItem>
          )}
          {!org && (
            <div className="px-2 py-1.5 text-xs text-muted-foreground">
              No organization yet
            </div>
          )}
        </DropdownMenuPopup>
      </DropdownMenu>

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
          <Link
            href="/dashboard/deploy"
            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground no-underline"
          >
            <PlusIcon className="size-4 shrink-0 opacity-60" />
            New project
          </Link>
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
    { label: 'Members', href: `${base}/members`, active: currentTab === 'members' },
    { label: 'Assistant', href: `${base}/assistant`, active: currentTab === 'assistant', comingSoon: true },
    { label: 'Analytics', href: `${base}/analytics`, active: currentTab === 'analytics', comingSoon: true },
    { label: 'Settings', href: `${base}/settings`, active: currentTab === 'settings', comingSoon: true },
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

type Member = {
  id: string
  createdAt: number
  role: 'admin' | 'member'
  user: {
    id: string
    email: string
    image: string | null
    name: string
  } | null
}

export function MembersTable({ members }: { members: Member[] }) {
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
