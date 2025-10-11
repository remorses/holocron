// @ts-ignore
import { DocsJsonType } from "docs-website/src/lib/docs-json.js"

export type HolocronSite = {
  siteId: string
  name: string | null
  orgId: string
  defaultLocale: string
  createdAt: Date
  githubFolder: string
  githubOwner: string | null
  githubRepo: string | null
  githubRepoId: number
  visibility: 'public' | 'private'
  metadata: Record<string, any>
  branch?: {
    branchId: string
    siteId: string
    title: string
    githubBranch: string
    createdAt: Date
    updatedAt: Date
    docsJson: DocsJsonType
    docsJsonComments: Record<string, any>
    cssStyles: string
    lastGithubSyncAt: Date | null
    lastGithubSyncCommit: string | null
    domains: Array<{
      id: string
      host: string
      domainType: 'customDomain' | 'internalDomain' | 'basepathDomain'
      branchId: string | null
    }>
  }
  domains?: Array<{
    id: string
    host: string
    domainType: 'customDomain' | 'internalDomain' | 'basepathDomain'
    branchId: string | null
  }>
}
