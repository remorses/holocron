# Changelog

## 2025-10-01 12:17

- Refactored OG image generation to be modular and reusable
- Moved OG generation logic to `src/lib/og.tsx` with customizable `generateOgImagePng` and `generateOgImageSvg` functions
- Simplified route to just call the library function with page metadata
- Created simpler test in `src/lib/og.test.ts` that generates snapshot images for visual inspection
- Use JSX syntax instead of createElement for better readability
- Keep same OpenAlternative-inspired styling with gradient background and Geist font

## 2025-09-16 18:00

- Refactored title removal to use React Context instead of prop manipulation
- Added TabGroupContext to control CodeBlock title visibility based on parent context
- Created context-aware wrappers for CodeBlock, CodeBlockTabs, and CodeBlockTab components
- Preserved Tabs auto-wrapping functionality for non-Tab children (needed for MDX code blocks)
- Kept title extraction logic for creating tab labels from code block titles

## 2025-08-11 13:25

- Added markdown link validation utility for checking internal links against valid slugs
- Created formatErrorWithContext function for consistent error formatting with line numbers and context
- Added comprehensive tests with inline snapshots for error formatting scenarios

## 2025-08-09 10:30

- Fixed missing pages showing empty content instead of 404 not found page
- Changed markdown initialization to use `null` instead of empty string when page is not found
- Updated BaseLoaderData type to allow `markdown?: string | null`

## 2025-08-04 10:00

- Refactored chat-tool-previews.tsx to use ShowMore component directly instead of embedding it in markdown
- Replaced markdown string interpolation with direct CodeBlock component usage for better type safety

## 2025-08-03

- Added ShowMore component for content height restriction with expand/collapse functionality
- Component displays gradient fade and expand button when content exceeds specified height

## 2025-08-02 12:00

- Implemented line restriction in remarkCodeToHtml for code blocks
- Added support for data-last-lines attribute in mdx-heavy.tsx
- Shows ellipsis (...) when code is truncated to indicate more content

## 2025-08-01 20:00

- Switch default AI model to Groq with qwen/qwen3-32b model
- Added @ai-sdk/groq dependency for Groq AI provider support

## 2025-08-01 18:50

- **Fix draft files returning 404**: Changed condition from `!markdown` to `markdown == null` to properly handle empty string draft content
- **Fix typo**: Correct "fiimport" to "import" in mdx.server.ts

## 2025-01-30

- Added graceful shutdown middleware for Spiceflow apps
- Created `preventProcessExitIfBusy` function with configurable wait times
- Applied middleware to docsApp to handle SIGINT/SIGTERM gracefully

## 2025-01-27

- Implement custom Link and navigate components that preserve search query parameters during navigation
- Configure fumadocs to use the custom Link component via a custom ReactRouterProvider
- Create globalNavigate function that preserves search params and can be used outside React components
- Remove forwardRef from PreservedSearchLink for simpler implementation
- Replace all window.location.href usages with globalNavigate to maintain search params

## 2025-01-26 18:00

- Add custom rendering for emphasis (italic), delete (strikethrough), and inline code in markdown chat component
- Apply distinct colors for each text style in dark mode
