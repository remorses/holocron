# Changelog

## 2025-08-15

- **Fixed race condition in table creation** - Handle concurrent table creation attempts by catching "already exists" error and opening existing table instead

## 2025-01-10 16:45

- **Fixed dataset not found error** - Check if table exists before attempting delete operations
- **Improved deleteFiles robustness** - Return early if table doesn't exist instead of creating empty table
- **Fixed deleteDataset** - Skip deletion gracefully when table doesn't exist in LanceDB

## 2025-01-10 15:30

- **Added proper TypeScript types** - Created `SectionRecord` and `SectionWithScore` interfaces to replace `any[]` types
- **Typed all database queries** - Added type assertions to all `.toArray()` calls for type safety
- **Improved code maintainability** - Replaced untyped arrays with properly typed interfaces throughout search functionality

## 2025-01-10 15:17

- **Simplified table management** - Refactored `getOrCreateTable` to automatically create tables with schema when missing
- **Removed complex existence checks** - Eliminated all `!table` null checks throughout the codebase
- **Added predefined table schema** - Defined table structure using Apache Arrow types for consistent table creation
- **Improved error handling** - Tables are now always guaranteed to exist, removing need for defensive checks
- **Fixed test issue** - Corrected inline snapshot syntax error in markdown parser test

## 2025-08-10 11:55

- delete old file rows before inserting updates to prevent duplicate sections

## 2025-08-04 20:17

- **Enhanced search ranking with weight system** - Implemented custom weight-based ranking for search results
- **Frontmatter prioritization** - All frontmatter sections now get weight 2.0 regardless of content
- **Heading level weights** - H1 (1.2), H2 (1.1), H3 (1.05), H4+ (1.0) for hierarchical ranking
- **Integrated weights into search scoring** - Both FTS and manual search now multiply scores by section weights
- **Added comprehensive weight system tests** - Tests verify frontmatter and heading hierarchy ranking behavior
- **Refactored markdown cleaning** - Now uses js-yaml for proper YAML parsing instead of regex
- **Unified cleaning function** - Single `cleanMarkdownContent` handles both frontmatter extraction and markdown cleaning
- **Graceful YAML error handling** - Invalid YAML frontmatter returns empty string instead of failing
- **Added frontmatter cleaning tests** - Comprehensive tests verify YAML value extraction and error handling

## 2025-01-31 16:00

### Code Quality Improvements

- **Refactored table caching logic** - Extracted repeated table caching code into a single `getOrCreateTable()` method for better maintainability
- **Extracted getExistingFiles method** - Moved file existence checking logic into a dedicated, well-tested method for better code organization
- **Added comprehensive test suite** - Created thorough tests for getExistingFiles including edge cases, SQL injection protection, and large dataset handling
- **Fixed TypeScript types** - Made weight field properly optional in FileSchema, removed non-existent waitForReplication parameter

## 2025-01-31 15:30

### Major Performance Optimizations

- **Removed SearchClient wrapper pattern** - Simplified architecture by removing unnecessary abstraction layer, keeping only LanceDB implementation
- **Optimized file existence checking** - Changed from O(n) database queries in loop to single upfront query with Map-based O(1) lookups (44.4% performance improvement)
- **Implemented mergeInsert for atomic upserts** - Replaced delete+add pattern with atomic mergeInsert operations, reducing upsert time from ~30s to ~0.8s for 500 files
- **Added automatic btree index creation** - Automatically creates btree index on filename column when needed for mergeInsert operations
- **Implemented IN clause optimization** - Only query for specific files being uploaded instead of scanning entire table
- **Added SHA-based deduplication** - Skip re-uploading files with unchanged content by comparing SHA hashes
- **Delayed FTS index creation** - Create full-text search indexes after bulk upload for better performance
- **Added table optimization** - Automatically optimize table (compact fragments) after large imports (>5000 files)
- **Implemented aggressive caching** - Cache table references and FTS index status to eliminate redundant database operations across all methods (upsertFiles, searchSections, etc.)
- **Removed unnecessary computations** - Eliminated vector placeholder field and cleanMarkdown computation during search
- **Fixed cloud database race conditions** - Handle "table already exists" errors gracefully during concurrent operations

### Bug Fixes

- Fixed FTS search errors by checking index existence before attempting search
- Added proper TypeScript types, removed all "as any" usage
- Fixed mergeInsert failures by ensuring btree index exists on filename column

### Performance Results

- Import speed: **7,341 files/second** (raw import)
- Import with indexing: **3,654 files/second** (includes FTS index creation)
- Search performance: **3-4ms** average (after first query)
- Successfully tested with 22,467 files dataset