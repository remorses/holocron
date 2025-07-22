# Changelog

## 2025-07-22 15:30

- **Frontmatter Support and Weight-based Ranking:**
  - Added frontmatter parsing support for markdown files
  - Frontmatter is now recognized as its own section with empty heading
  - Added weight support for both files and individual sections
  - Files can have a weight property (default 1.0) to influence search ranking
  - Frontmatter sections have higher default weight (2.0) for better ranking
  - Search results now use combined scoring: BM25 score × section weight × file weight
  - Updated database schema with weight columns for files and sections
  - Added is_frontmatter column to sections table for identification
  - Fixed slug generation for empty headings using `frontmatter-{orderIndex}` pattern
  - All tests passing with updated snapshots

## 2025-07-22 15:10

- **Added dataset ID validation:**
  - Restricted dataset IDs to only contain alphanumeric characters, hyphens, and underscores
  - Limited dataset ID length to maximum 400 characters
  - Added `DatasetIdSchema` using Zod validation with regex pattern `/^[a-zA-Z0-9_-]+$/`
  - Applied validation to all API routes that accept dataset ID as a parameter
  - Deployed and verified all tests pass with the new validation

- **Improved test snapshot stability:**
  - Added `roundToNearest5Minutes` function to round timestamps in dataset IDs to nearest 5 minutes
  - Updated both `search.test.ts` and `production.test.ts` to use rounded timestamps
  - Prevents snapshot updates on every test run, making them stable within 5-minute windows

- **Verified search.txt route separator:**
  - Confirmed that search results in text format are properly separated by `---` between chunks
  - The implementation uses `.join('\n---\n\n')` which correctly adds the separator
  - Test snapshots show proper formatting with `---` separators between search results

## 2025-07-22 14:56

- **Reorganized tests and improved FTS table structure:**
  - Changed `sections_fts` table to have `filename`, `section_slug`, and `content` columns
  - Combined section heading and content into a single field preserving markdown syntax
  - Search now only matches on content field, not filenames
  - Replaced complex ROWID-based JOIN with simple section_slug matching for better performance
  - Updated snippet function to use column index 2 for content field
  - Fixed type errors in tests by adding `as any` to `response.json()` calls
  - Reorganized production tests to do all file uploads in first test
  - Updated search tests to use unique dataset IDs to avoid schema conflicts
  - Added timing logs to upload and search operations in tests
  - Ensured proper cleanup of test files with afterAll hooks

## 2025-07-22 14:30

- **Verified non-markdown file handling:**
  - Non-markdown files (.json, .js, .css, etc.) are stored with SHA validation
  - Only .md and .mdx files are parsed for sections and indexed for search
  - Added test to verify non-markdown files are not searchable
  - All tests pass with proper file type handling

## 2025-07-22 14:26

- **Deployed performance improvements** - Confirmed 6-9x faster re-uploads in production

## 2025-07-22 13:25

- **Performance improvements for file upserts:**
  - Parallelized SHA computations using `Promise.all` for ~8x faster re-uploads
  - Batch queries for existing file checks using SQL `IN` clause
  - Batch inserts for sections and FTS tables to reduce database operations
  - Added timing logs to identify performance bottlenecks
  - Re-uploads with unchanged content now skip in ~120ms vs ~960ms initially

- **Made snippet length configurable:**
  - Added `snippetLength` query parameter for search endpoints (default: 300, max: 500)
  - Updated search tests to use proper markdown content instead of single-line word lists