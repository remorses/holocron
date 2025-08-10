# Changelog

## 2025-08-10 12:00

- **Added validation to updateFumabaseJsonc tool**: Checks that LLM has read fumabase.jsonc file before allowing updates
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
