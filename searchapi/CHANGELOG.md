# Changelog

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
- **Implemented aggressive caching** - Cache table references and FTS index status to eliminate redundant database operations
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