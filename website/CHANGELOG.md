# Changelog

## 2025-01-30 14:00

- Block navigation when user has unsaved changes in chat view
- Add `useConfirmLeave` hook to lib/hooks.tsx with configurable message
- Hook handles both SPA navigation and browser tab close/reload confirmation
- Automatically shows confirmation dialog when navigation is blocked

## 2025-01-30 12:30

- Fix docs.json (holocron.jsonc) not being saved when updating website files through chat
- Refactor `assetsFromFilesList` to remove docsJson/docsJsonComments parameters
- Refactor `syncSite` to remove docsJson parameter, replace with ignorePatterns
- Require callers to explicitly include holocron.jsonc in files array when needed
- Only update docsJson in database when holocron.jsonc is explicitly modified

## 2025-01-25 11:00

- Refactor public REST API v1 with simplified architecture
- Remove upsert route to keep API simpler
- Add DELETE /api/v1/sites/:siteId/files endpoint to delete specific files from a site
- Delete files from search API when deleting files
- Update GET /api/v1/sites/:siteId to return docsJson from the site's branch
- Assume sites have only one branch for API simplicity
- All branch operations now use the first branch automatically
- Import searchApi client for file deletion operations
- Fix CloudflareClient method name from deleteDomain to removeDomain
- Extract and export filesSchema for reuse across both internal and public APIs
- Update /upsertSiteFromFiles route to use the exported filesSchema

## 2025-01-25 10:45

- Add public REST API v1 for external integrations
- Create spiceflow-public-api.ts with versioned REST endpoints at /api/v1
- Implement API key authentication using x-api-key header (uses existing CLI login sessions)
- Add POST /api/v1/sites endpoint to create new documentation sites
- Add POST /api/v1/sites/:siteId/sync endpoint to sync files to existing sites
- Add POST /api/v1/sites/:siteId endpoint to update site configuration
- Add GET /api/v1/sites endpoint to list all accessible sites
- Add GET /api/v1/sites/:siteId endpoint to get site details
- Add DELETE /api/v1/sites/:siteId endpoint to delete sites and associated domains
- Reuse existing filesSchema from spiceflow.ts to avoid duplication
- Remove response type definitions to keep routes flexible
- Delete domains from Cloudflare when deleting sites
- Reuse existing createSite and syncSite functions from internal implementation
- Mount public API app to main spiceflow app
- Include OpenAPI documentation support and proper error handling

## 2025-01-25 09:25

- Add Google Search support as fallback when Firecrawl is not available
- Install @googleapis/customsearch dependency
- Add GOOGLE_SEARCH_API_KEY environment variable
- Create web-search-google-preview.tsx component for Google Search results
- Integrate Google Search tool that triggers when FIRECRAWL_API_KEY is not set
- Update both search preview components to show URL instead of description
- Use Google SDK types (customsearch_v1.Schema$Search) for type safety

## 2025-01-25 09:20

- Add Firecrawl web search tool for AI models that don't have native web search
- Install @mendable/firecrawl-js dependency
- Add FIRECRAWL_API_KEY environment variable
- Implement webSearchFirecrawl tool that returns raw Firecrawl search results
- Add tool preview rendering in chat.tsx for webSearchFirecrawl results
- Display web search results with title, URL, and description in a clean format
- Style web search results to match todo preview with tree-like Unicode characters (⎿ and •)

## 2025-01-24 20:20

- Add variant prop support to Select component (ghost variant removes border)
- Update visibility select to use ghost variant to match other toolbar buttons

## 2025-01-24 20:15

- Merge GitHub sync status into tooltip on GitHub repo button
- Remove separate GitHubSyncStatus button from toolbar
- Update all toolbar buttons to use size "sm" and variant "ghost" for consistency

## 2025-01-24 20:10

- Switch to JSONC parser for meta.json validation instead of extractJsonCComments
- Check if pages array is missing "..." anywhere (not just at the end)
- Remove unused test file for meta.json validation

## 2025-01-24 20:00

- Validate meta.json files to ensure "..." is always the last item in pages array
- Use JSONC parser to handle comments in meta.json files correctly
- Show clear error message when meta.json is missing the "..." wildcard

## 2025-08-11 13:20

- Unified error formatting with `formatErrorWithContext` function for consistent error display
- Deduplicated error formatting code across MDX, JSON, and link validation errors
- All validation errors now show context with line numbers and error indicators

## 2025-08-11 13:10

- Validate markdown links in AI-generated content against available page slugs
- Show helpful error messages listing invalid links with line/column numbers
- Provide list of available slugs to help AI fix broken links

## 2025-08-10 12:00

- **Added validation to updateHolocronJsonc tool**: Checks that LLM has read holocron.jsonc file before allowing updates
- **Better error handling**: Returns clear error message when tool is called without first reading the file

## 2025-08-10 12:23

- Create PR and push actions now open spinner page in new tab and redirect to GitHub
- PR spinner routes use internal GitHub logic without Spiceflow client

## 2025-08-09 14:30

- **Fix foreign key constraint error**: Set `githubSha` to null for pages with parse errors instead of invalid empty string
- **Schema improvement**: Made `MarkdownPage.githubSha` nullable to properly handle markdown parsing failures
- **Cleaner error handling**: Skip MarkdownBlob creation for pages with parse errors, avoiding unnecessary database entries

## 2025-08-08 11:45

- **System message testing**: Added reusable `generateSystemMessage()` function and test snapshots
- **Test coverage improvement**: Created separate test for system message input with both onboarding and regular modes
- **Code organization**: Extracted system message generation logic for better maintainability

## 2025-08-08 11:30

- **Enhanced icon validation**: Added real-time validation for Lucide icons in markdown frontmatter
- **Improved AI feedback**: AI now receives `WARNING: you used an invalid icon "x", to see the possible icons fetch the url https://lucide.dev/icons/` when using invalid icon names
- **Better user experience**: Prevents invalid icons from being used in documentation pages

## 2025-08-07 20:55

- Removed `isOnboardingChat` parameter from generateMessageStream
- Auto-detect onboarding mode based on empty filesInDraft
- Fixed file deduplication in filesInDraftToMarkdown utility

## 2025-08-07 20:30

- Added test case for adding Lucide icons to documentation pages
- Created `isValidLucideIconName` utility function to validate icon names against @iconify-json/lucide package
- Enhanced test validation to check for valid Lucide icon names in page frontmatter

## 2025-08-07

- Replaced state and useMemo with React Query for fetching resolved stats in `DiffStats` component
- Added React Query provider to root component for better data fetching management
- Extracted `generateMessageStream` function from Spiceflow handler for better testability
- Removed Prisma dependency from `generateMessageStream` completely
- Replaced branch/chat objects with granular fields (githubFolder, defaultLocale, locales, etc.)
- Moved database operations to onFinish callback in Spiceflow handler
- Made isOnboardingChat an explicit input parameter
- Moved FileSystemEmulator instantiation to Spiceflow route
- Made files an input argument to remove internal getFilesForSource call
- Removed branchId from generateMessageStream parameters
- Added experimental_wrapLanguageModel middleware support for AI models
- Created comprehensive test for generateMessageStream with AI cache middleware
- Added testGenerateMessage utility function that accepts CoreMessage[] for easier testing
- Implemented comprehensive markdown conversion for all UI message part types:
    - Text, reasoning, tool calls, tool states (input/output/error)
    - File attachments, source URLs, step boundaries
    - Special formatting for strReplaceEditor tool (view, create, str_replace)
- Used readUIMessageStream with asyncIterableToReadableStream for proper stream consumption
- Added snapshot testing with detailed markdown output showing full conversation flow
- Created generate-message-utils.ts with reusable test utilities
- Made testGenerateMessage an async generator that yields intermediate results
- Added currentSlug parameter with default value '/'
- Implemented partial snapshot writing during streaming for debugging
- Used while loop pattern for iterating async generators in tests
- Exported TestGenerateMessageResult and TestGenerateMessageInput types
- Parametrized tests using array of test cases with name and onFinish callbacks
- Created for loop to generate individual tests for each test case
- Added filesInDraftToMarkdown serializer with file tree visualization using printDirectoryTree
- Updated tests to write both message and files snapshots with 50ms throttling for partial writes
- Snapshot files now use naming convention: name-message.md and name-files.md
- Updated uiMessageToMarkdown to use YAML format wrapped in XML tags for tool rendering
- Disabled smoothStream transformation when process.env.VITEST is defined for faster test execution

## 2025-08-04

- Refactored chat components into separate files for better organization
- Created `chat-buttons.tsx` with `SaveChangesButton`, `DiffStats`, and `PrButton` components
- Created `chat-welcome.tsx` with `WelcomeMessage` and related components
- Extracted `uploadFileToSite` and `transcribeAudio` functions to `utils.ts`
- Renamed `tools-preview.tsx` to `chat-tool-previews.tsx` for consistency

## 2025-08-02 12:00

- Simplified tools-preview.tsx to show code snippets for mutation operations
- Added data-last-lines attribute support to limit displayed lines in code blocks
- Replaced complex diff parsing with direct code snippet rendering

## 2025-08-01 20:00

- Switch default AI model to Groq with qwen/qwen3-32b model
- Added @ai-sdk/groq dependency for Groq AI provider support

## 2025-08-01 19:00

- **FileSystemEmulator**: Verified move operations correctly delete old paths
- **Added tests**: Created comprehensive tests for file move deletion behavior
- **Fixed getProjectFiles tool**: Handle deleted files in the second loop by marking paths for removal instead of filtering in the first loop

## 2025-01-30 11:00

- Created reusable graceful shutdown middleware using Spiceflow middleware pattern
- Migrated from manual request counting to middleware-based approach
- Process gracefully waits for active requests with configurable timeout

## 2025-01-26 20:30

- Added toolCallId prop to Dot component for showing pulse animation on pending tool calls
- Implemented logic to check if tool call is the last one and still processing
- Added pulse animation using Tailwind animate-pulse class when tool is in progress
- Updated directory-tree to show tree connectors (├──) for top-level paths
- Added directory collapsing for parent folders with single child folders (e.g., `parent1/parent2/xx`)
- Added test cases for directory collapsing including single root with nested single-child directories
- Updated all test snapshots to reflect the new tree structure

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
