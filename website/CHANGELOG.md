# Changelog

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