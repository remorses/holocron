# Changelog

## 2025-01-26 20:30

- Added toolCallId prop to Dot component for showing pulse animation on pending tool calls
- Implemented logic to check if tool call is the last one and still processing
- Added pulse animation using Tailwind animate-pulse class when tool is in progress

## 2025-01-26 19:00

- Refactored file operations to use a new FileSystemEmulator class
- Created FileSystemEmulator class with batch operations support for read, write, delete, and move operations
- Updated createEditTool to accept FileSystemEmulator instead of individual parameters
- Integrated FileSystemEmulator in website and docs-website components with global and preview instances
- Simplified renameFile and deletePages tools to use FileSystemEmulator methods
- Removed createGlobalFileSystemEmulator and createDocsGlobalFileSystemEmulator functions in favor of creating FileSystemEmulator instances directly
- Updated to use in-scope filesInDraft variable in chat.tsx and docs-chat.tsx

## 2025-01-26 18:35

- Added renameFile tool to spiceflow-generate-message.tsx for renaming or moving files within the website
- Added renameFile type definition to WebsiteTools interface
- The rename tool preserves file content while updating the path and properly manages filesInDraft state
- Supports renaming both existing database files and draft files
- Updates filesInDraft by creating a new entry for the new path and marking the old path as deleted

## 2025-01-26 14:30

- Fixed ToolPreviewContainer usage in tools-preview.tsx by properly passing toolName and inputString props
- Replaced markdown diff views with FileEditPreview component from contesto for better diff visualization in replace command
- Added parsePatch import from diff package to parse hunks for FileEditPreview
- Updated all ToolPreviewContainer calls in chat.tsx to pass required props
- Deduplicated create and insert commands into single code path using Markdown with code snippets
- Removed Markdown component usage for view and error commands in favor of plain HTML
- Fixed diff parsing from string results using parsePatch instead of expecting result.hunks
- Kept Markdown component for create/insert commands to show code snippets with syntax highlighting

## 2025-01-24 20:45

- Removed clientLoader from connect-github route as it cannot use Prisma on the client side
- Updated connect GitHub button to link directly to /api/github/install with next parameter
- Modified connect-github route to always expect github_login_data cookie from install flow
- Simplified the flow so connect-github route never redirects to install route
- Updated documentation to reflect the new direct-to-install flow
- Added siteGithubInstallation creation for sites that already have githubOwner and githubRepo set

## 2025-01-24 20:30

- Renamed connect-site route to connect-github for better clarity
- Updated to always set githubOwner when connecting GitHub, even for existing repositories
- Enhanced repository creation to use actual site content instead of example templates
- Implemented reuse of existing domains for repository homepage URLs
- Added preservation of existing docsJson configuration when creating repositories
- Improved fallback behavior to only use starter template when site has no content
- Exported GITHUB_LOGIN_DATA_COOKIE constant from api.github.webhooks.ts for consistent cookie naming

## 2025-01-24 20:15

- Simplified GitHub repository connection flow by removing unnecessary `github_connect_state` cookie
- Updated connect-site route to use URL parameters for orgId and siteId instead of storing them in cookies
- Migrated GithubLoginRequestData type from github.server.ts to lib/types.ts for better organization
- Replaced URL search parameters with secure HTTP-only cookies for passing GitHub account login data
- Updated InstallGithubAppToolbar to use Link component instead of window.location for better navigation
- Created comprehensive documentation with mermaid diagrams explaining the GitHub connection flow