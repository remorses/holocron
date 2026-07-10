// Dashboard AI chat widget — mounts the standalone ChatWidget on dashboard
// pages with browser automation tools (pageTools) so the AI can navigate,
// highlight elements, and guide users through the dashboard UI.
//
// Context injection: passes the current user's info and project details
// so the AI knows who it's talking to and what they're working on.

'use client'

import { ChatWidget, pageTools } from '@holocron.so/vite/chat'
import type { ChatToolDefinition } from '@holocron.so/vite/chat'
import { useLoaderData, router } from 'spiceflow/react'
import type { dashboardApp } from '../dashboard.tsx'

type DashboardApp = typeof dashboardApp

const dashboardPages = [
  {
    path: '/dashboard',
    description: 'Dashboard home. Redirects to the first project if one exists, otherwise shows a setup panel with two options: create from GitHub template, or scaffold locally with the CLI.',
  },
  {
    path: '/dashboard/projects/:id',
    description: 'Project overview tab. Shows the project name, linked GitHub repo, site URL, custom domains, default branch, creation date, and a table of the 20 most recent deployments with URL, time, user avatar, branch, and status (active/uploading/superseded). If the project has no deployments yet, shows a setup panel prompting the user to deploy via GitHub template or CLI.',
  },
  {
    path: '/dashboard/projects/:id/keys',
    description: 'API keys tab. Lists all deploy keys for this project (name, key prefix, creation date). Keys are used to authenticate CI deployments and CLI deploys via the HOLOCRON_KEY env var.',
    actions: [
      { name: 'create_key', description: 'Opens a dialog to create a new API key. User enters a name, then gets the full key to copy (only shown once).', selector: '[data-action="create-key"]' },
    ],
  },
  {
    path: '/dashboard/projects/:id/members',
    description: 'Team members tab. Shows a table of all organization members with name, email, role (admin/member), and join date.',
    actions: [
      { name: 'invite_member', description: 'Opens a dialog to generate a 7-day invite link. Anyone with the link can join all sites in the organization.', selector: '[data-action="invite-member"]' },
    ],
  },
  {
    path: '/dashboard/projects/:id/billing',
    description: 'Billing tab. If the project has no subscription, shows the Holocron Pro pricing card ($99/month or $990/year) with feature list: AI chat assistant, unlimited preview deployments, analytics. If already subscribed, shows the current plan, billing interval, renewal/cancellation date, and a button to manage the subscription via Stripe billing portal.',
    actions: [
      { name: 'subscribe_monthly', description: 'Start a monthly Pro subscription ($99/month). Opens Stripe Checkout.', selector: '[data-action="subscribe-monthly"]' },
      { name: 'subscribe_yearly', description: 'Start a yearly Pro subscription ($990/year, 2 months free). Opens Stripe Checkout.', selector: '[data-action="subscribe-yearly"]' },
      { name: 'manage_subscription', description: 'Open the Stripe billing portal to update payment method, switch plans, or cancel. Only visible when already subscribed.', selector: '[data-action="manage-subscription"]' },
    ],
  },
  {
    path: '/dashboard/projects/:id/settings',
    description: 'Project settings tab. Contains multiple sections: General (rename project), Project Info (read-only project ID, subdomain, GitHub repo, default branch), GitHub Organization Access (grant Holocron access to GitHub orgs for deployments), Google Search Console (connect/disconnect GSC, select property), Custom Domains (add/remove custom domains, check DNS/SSL status; requires Pro), and Danger Zone (permanently delete the project and all its data).',
    actions: [
      { name: 'save_project_name', description: 'Save a new display name for the project', selector: '[data-action="save-project-name"]' },
      { name: 'grant_org_access', description: 'Open GitHub settings to grant Holocron access to your GitHub organizations (needed for org repo deployments)', selector: '[data-action="grant-org-access"]' },
      { name: 'connect_gsc', description: 'Start Google Search Console OAuth flow to connect search analytics', selector: '[data-action="connect-gsc"]' },
      { name: 'add_domain', description: 'Open dialog to add a custom domain. Shows CNAME target after creation. Requires Pro subscription.', selector: '[data-action="add-domain"]' },
      { name: 'delete_project', description: 'Start the project deletion flow. Requires typing the project name to confirm. Permanently removes the site, all deployments, API keys, and subscription.', selector: '[data-action="delete-project"]' },
    ],
  },
  {
    path: '/dashboard/projects/:id/assistant',
    description: 'AI Assistant configuration tab. Coming soon.',
  },
  {
    path: '/dashboard/projects/:id/analytics',
    description: 'Analytics tab showing page views and search console data. Coming soon.',
  },
  {
    path: '/dashboard/deploy',
    description: 'Create a new docs project. Shows two setup cards: create from the GitHub template (opens the template repo), or scaffold locally with the CLI (npx -y "@holocron.so/cli" create). The site is created on the first deployment.',
  },
]

const browserTools: ChatToolDefinition[] = pageTools(dashboardPages)

export function DashboardChat() {
  const { user, org, projects, hasSubscription } = useLoaderData<DashboardApp, '/dashboard/*'>('/dashboard/*')

  const currentPath = typeof window !== 'undefined' ? window.location.pathname : '/dashboard'
  const projectMatch = currentPath.match(/^\/dashboard\/projects\/([^/]+)/)
  const currentProjectId = projectMatch?.[1] ?? null
  const currentProject = currentProjectId
    ? projects.find((p) => p.projectId === currentProjectId)
    : null

  const context: Record<string, unknown> = {
    currentPage: currentPath,
    user: { name: user.name, email: user.email },
    organization: org ? { name: org.name } : null,
    projectCount: projects.length,
    ...(currentProject ? {
      currentProject: {
        name: currentProject.name,
        projectId: currentProject.projectId,
      },
    } : {}),
    ...(hasSubscription !== null ? { hasSubscription } : {}),
  }

  return (
    <ChatWidget
      domain='holocron.so'
      siteName='Holocron'
      theme='system'
      tools={browserTools}
      context={context}
      navigate={(path) => router.push(path)}
    />
  )
}
