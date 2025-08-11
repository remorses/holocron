---
title: syncSite Function Documentation
description: Core synchronization function for Fumabase documentation sites
prompt: |
  Document the syncSite function and media asset handling in Fumabase.
  Read @website/src/lib/sync.ts to understand:
  - How media files are detected and processed
  - The downloadUrl field functionality
  - When assets are uploaded to S3 vs when they're skipped
  - The overall sync workflow
  Additional context from:
  - @website/src/routes/org.$orgId.onboarding.tsx
  - @website/src/routes/api.github.webhooks-worker.ts  
  - @website/src/lib/spiceflow.ts
  - @website/src/components/chat-buttons.tsx
  - @cli/src/cli.ts
---

# syncSite Function Documentation

## Overview

`syncSite` is the core function responsible for synchronizing documentation files to the Fumabase database. It processes markdown files, media assets, and configuration updates to maintain the documentation site state.

## Usage Locations

### 1. **User Onboarding**

**File:** `website/src/routes/org.$orgId.onboarding.tsx:68`

Creates the initial documentation site when new users join:

- Sets up starter documentation with default `fumabase.jsonc` configuration
- Creates internal domains (e.g., `username-hash.domain.com`)
- Initializes the main branch structure
- Provides a ready-to-use documentation template

### 2. **GitHub Webhook Integration**

**File:** `website/src/routes/api.github.webhooks-worker.ts:174`

Automatically syncs changes from GitHub repositories:

- Triggered on GitHub push events via webhooks
- Updates site content when commits are pushed to connected repos
- Processes only changed files for efficient updates
- Maintains sync between GitHub and Fumabase database

### 3. **API Routes (Spiceflow)**

#### `/saveChangesForChat`

**File:** `website/src/lib/spiceflow.ts:750`
**Called by:** `website/src/components/chat-buttons.tsx`

Saves changes made through the chat interface:

- Processes files modified during chat conversations
- Updates the site with AI-assisted edits
- Maintains draft state for iterative changes

#### `/upsertSiteFromFiles`

**File:** `website/src/lib/spiceflow.ts:1018`
**Called by:** CLI tool (`cli/src/cli.ts:601`)

Handles complete site creation or updates:

- Used by `fumabase push` CLI command
- Creates new sites with initial content
- Updates existing sites with bulk file changes
- Processes both markdown and media files

#### `/commitChangesPr` (Internal sync before PR)

**File:** `website/src/lib/spiceflow.ts:677`

Syncs changes before creating GitHub pull requests:

- Ensures local changes are saved before PR creation
- Part of the GitHub integration workflow
- Maintains consistency between Fumabase and GitHub

## Workflow Summary

```
┌─────────────┐
│   CLI Tool  │──► fumabase push ──► /upsertSiteFromFiles ──► syncSite
└─────────────┘

┌─────────────┐
│   GitHub    │──► webhook (on push) ──► /api/github/webhooks-worker ──► syncSite
└─────────────┘

┌─────────────┐
│   Chat UI   │──► Save Changes ──► /saveChangesForChat ──► syncSite
└─────────────┘

┌─────────────┐
│ Onboarding  │──► Create Starter Site ──► syncSite
└─────────────┘
```

## Key Features

- **Idempotent Operations**: Safe to call multiple times with the same data
- **Incremental Updates**: Processes only changed files when possible
- **Multi-source Support**: Handles files from GitHub, CLI uploads, and chat edits
- **Asset Processing**: Manages both markdown content and media files
- **Configuration Updates**: Processes `fumabase.jsonc` changes including domain updates

## Media Asset Handling

### Supported Media Extensions

Media files are identified by their extensions (`sync.ts:115-140`):

**Images:** `.jpg`, `.jpeg`, `.png`, `.gif`, `.bmp`, `.webp`, `.svg`, `.ico`, `.tif`, `.tiff`, `.avif`

**Videos:** `.mp4`, `.mov`, `.avi`, `.wmv`, `.flv`, `.webm`, `.mkv`, `.m4v`, `.3gp`, `.ogg`, `.ogv`

### How Media Assets Are Processed

1. **Detection**: Files are checked against the media extensions list using `isMediaFile()` function
2. **Metadata Extraction**: For images, dimensions (width/height) are extracted using `imageDimensionsFromData`
3. **Storage Decision**: Based on the `downloadUrl` field

### The `downloadUrl` Field

The `downloadUrl` field determines how media assets are handled:

#### **When Assets Are Uploaded to S3**

Assets are uploaded to S3 when (`sync.ts:527-599`):
- The `downloadUrl` exists AND
- The URL is NOT already from `UPLOADS_BASE_URL` (Fumabase's S3 bucket)

Process:
1. Download the file from the provided `downloadUrl`
2. Extract metadata (dimensions for images, file size)
3. Upload to S3 at path: `site/${siteId}/mediaAssets${slug}`
4. Store metadata in `MediaAsset` table

#### **When Uploads Are Skipped**

Assets are NOT re-uploaded when:
- The `downloadUrl` already starts with `UPLOADS_BASE_URL`
- This prevents redundant uploads of already-hosted assets
- Example: Assets previously uploaded remain at their S3 location

### Media Asset Flow by Source

#### **CLI Upload** (`cli/src/cli.ts:569-597`)
1. CLI reads local media files
2. Extracts dimensions using `imageDimensionsFromData`
3. Sends metadata (width, height, bytes) to API
4. API uploads to S3 separately via `uploadMediaFiles()`
5. `downloadUrl` field is empty initially

#### **GitHub Sync** (`sync.ts:1262-1303`)
1. GitHub API provides `download_url` for each media file
2. `syncSite` receives this as `downloadUrl` field
3. Files are downloaded from GitHub and uploaded to S3
4. Metadata extracted during download process

#### **Chat Interface** (`spiceflow.ts:729-757`)
1. Media files referenced in markdown are tracked
2. Uses existing S3 URLs (no re-upload needed)
3. Updates `PageMediaAsset` relations for image references

### Database Storage

Media assets are stored in the `MediaAsset` table with:
- `slug`: URL path for the asset (e.g., `/images/logo.png`)
- `githubPath`: Original file path in repository
- `githubSha`: Git blob SHA for versioning
- `width`/`height`: Image dimensions (if applicable)
- `bytes`: File size
- `branchId`: Associated branch

### Caching and CDN

- Assets are served through Cloudflare CDN
- Cache tags are generated using `getCacheTagForMediaAsset()`
- Cache invalidation occurs on updates
- Public URL format: `{UPLOADS_BASE_URL}/site/${siteId}/mediaAssets${slug}`

## Related Components

- **Database Tables**: `Site`, `SiteBranch`, `MarkdownPage`, `MarkdownBlob`, `MediaAsset`, `PageMediaAsset`
- **File Processing**: `assetsFromFilesList`, `filesFromGithub`
- **S3 Integration**: `getPresignedUrl`, `getKeyForMediaAsset`
- **Authentication**: Validates user access through org membership
- **Error Handling**: Creates `MarkdownPageSyncError` records for problematic files
