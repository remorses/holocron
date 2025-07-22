# Changelog

## 2025-07-22 14:45

- **Simplified FTS table structure and improved query performance:**
  - Changed `sections_fts` table to have `filename`, `section_slug`, and `content` columns
  - Combined section heading and content into a single field preserving markdown syntax
  - Search now only matches on content field, not filenames
  - Replaced complex ROWID-based JOIN with simple section_slug matching for better performance
  - Updated snippet function to use column index 2 for content field

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