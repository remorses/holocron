import { describe, test, expect } from 'vitest'
import { searchDocsWithTrieve } from './trieve-search'
import { prisma } from 'db'

describe('searchDocsWithTrieve', () => {
    test('returns empty array when no trieveDatasetId provided', async () => {
        const siteBranch = await prisma.siteBranch.findFirst({
            where: {
                domains: {
                    some: {
                        host: 'docs.fumabase.com',
                    },
                },
            },
            select: {
                trieveDatasetId: true,
            },
        })
        const result = await searchDocsWithTrieve({
            query: 'markdown',
            trieveDatasetId: siteBranch?.trieveDatasetId,
        })

        expect(result).toMatchInlineSnapshot(`
          [
            {
              "content": "Images and Embeds",
              "id": "page0fc4904a-dcbb-4d56-9ff2-f10023641c07",
              "type": "page",
              "url": "/essentials/images",
            },
            {
              "content": "src: https://www.youtube.com/embed/4KzFe50RQkQ",
              "id": "/essentials/images-embeds-and-html-elements-content",
              "line": 34,
              "type": "text",
              "url": "/essentials/images#embeds-and-html-elements",
            },
            {
              "content": "Using Markdown",
              "id": "/essentials/images-using-markdown-heading",
              "line": 14,
              "type": "heading",
              "url": "/essentials/images#using-markdown",
            },
            {
              "content": "FumaBase Sync Architecture",
              "id": "pagee834a9f0-408e-4c4e-bf33-a6f4abebf250",
              "type": "page",
              "url": "/sync-architecture",
            },
            {
              "content": "Union type representing different syncable assets:",
              "id": "/sync-architecture-assetforsync-syncts67-105-content",
              "line": 192,
              "type": "text",
              "url": "/sync-architecture#assetforsync-syncts67-105",
            },
            {
              "content": "chart: erDiagram
              Site ||--o{ SiteBranch : has
              Site ||--o{ GithubInstallation : uses
              SiteBranch ||--o{ MarkdownPage : contains
              SiteBranch ||--o{ MediaAsset : contains
              SiteBranch ||--o{ MetaFile : contains
              SiteBranch ||--o{ Domain : has
              MarkdownPage ||--|| MarkdownBlob : references
              MarkdownPage ||--o{ MarkdownPageSyncError : has
              MarkdownPage ||--o{ PageMediaAsset : uses

              Site {
                  string siteId PK
                  string orgId FK
                  string name
                  string githubOwner
                  string githubRepo
                  number githubRepoId
                  string githubFolder
              }

              SiteBranch {
                  string branchId PK
                  string siteId FK
                  string title
                  string githubBranch
                  json docsJson
                  json docsJsonComments
                  string cssStyles
                  string trieveDatasetId
                  string trieveReadApiKey
                  datetime lastGithubSyncAt
              }

              MarkdownPage {
                  string pageId PK
                  string branchId FK
                  string slug
                  string title
                  string githubPath
                  string githubSha FK
                  string extension
                  json frontmatter
              }

              MarkdownBlob {
                  string githubSha PK
                  string markdown
                  json structuredData
              }",
              "id": "/sync-architecture-database-schema-inferred-content",
              "line": undefined,
              "type": "text",
              "url": "/sync-architecture#database-schema-inferred",
            },
            {
              "content": "This is the primary sync flow that imports content from GitHub into the database.",
              "id": "/sync-architecture-1-github-to-database-sync-content",
              "line": 50,
              "type": "text",
              "url": "/sync-architecture#1-github-to-database-sync",
            },
            {
              "content": "a) Split syncSite into smaller functions:",
              "id": "/sync-architecture-recommendations-1-content",
              "line": 364,
              "type": "text",
              "url": "/sync-architecture#recommendations-1",
            },
            {
              "content": "Writing Accessible Documentation",
              "id": "page2ebacf07-579e-4441-a47d-69d378ce6120",
              "type": "page",
              "url": "/writing/accessibility",
            },
            {
              "content": "Provide text alternatives for multimedia content:",
              "id": "/writing/accessibility-video-and-interactive-content-content",
              "line": 95,
              "type": "text",
              "url": "/writing/accessibility#video-and-interactive-content",
            },
          ]
        `)
    })
})
