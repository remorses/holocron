import { describe, test, expect } from 'vitest'
import { generateLlmsFullTxt } from './llms-full-txt'

describe('generateLlmsFullTxt', () => {
    test('example domain', async () => {
        const result = await generateLlmsFullTxt({
            domain: 'docs.fumabase.com',
            searchQuery: 'markdown',
        })

        expect(result).toMatchInlineSnapshot(`
          "**Source:** https://docs.fumabase.com/essentials/images.md

          Images and Embeds

          ━━━

          **Source:** https://docs.fumabase.com/essentials/images.md?startLine=34#embeds-and-html-elements

          src: https://www.youtube.com/embed/4KzFe50RQkQ

          ━━━

          **Source:** https://docs.fumabase.com/essentials/images.md?startLine=14#using-markdown

          Using Markdown

          ━━━

          **Source:** https://docs.fumabase.com/sync-architecture.md

          FumaBase Sync Architecture

          ━━━

          **Source:** https://docs.fumabase.com/sync-architecture.md?startLine=192#assetforsync-syncts67-105

          Union type representing different syncable assets:

          ━━━

          **Source:** https://docs.fumabase.com/sync-architecture.md#database-schema-inferred

          chart: erDiagram
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
              }

          ━━━

          **Source:** https://docs.fumabase.com/sync-architecture.md?startLine=50#1-github-to-database-sync

          This is the primary sync flow that imports content from GitHub into the database.

          ━━━

          **Source:** https://docs.fumabase.com/sync-architecture.md?startLine=364#recommendations-1

          a) Split syncSite into smaller functions:

          ━━━

          **Source:** https://docs.fumabase.com/writing/accessibility.md

          Writing Accessible Documentation

          ━━━

          **Source:** https://docs.fumabase.com/writing/accessibility.md?startLine=95#video-and-interactive-content

          Provide text alternatives for multimedia content:

          ━━━

          "
        `)
    })
}, 1000 * 10)
