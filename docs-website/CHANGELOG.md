# Changelog

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