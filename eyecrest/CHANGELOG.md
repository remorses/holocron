# Changelog

## 2025-07-22 19:50

- **Added File Upload Limit and Filename Validation:**
  - Limited the number of files that can be uploaded in a single request to 100
  - Added `.max(100)` validation to the Zod schema for the files array
  - Added filename validation compatible with S3 object key safe characters
  - Allowed characters: alphanumeric, `!`, `_`, `.`, `*`, `'`, `(`, `)`, `-`, `/`
  - Filenames limited to 500 characters maximum
  - Validation regex: `/^[a-zA-Z0-9!_.*'()\-\/]+$/` (S3-compatible safe character set)
  - Returns 422 error with detailed validation message when validation fails
  - Returns 500 error when file count exceeds 100 (happens in DO)

- **Added TypeScript Types for SQLite Tables:**
  - Created proper TypeScript interfaces for all SQLite tables: `FileRow`, `SectionRow`, `DatasetRow`, `SearchResultRow`
  - Replaced all `as any` and `as string` type assertions with proper typed SQL queries
  - All `sql.exec` calls now use generic type parameter to specify return type
  - Improved type safety throughout the codebase, eliminating runtime type assumptions
  - Added cleanup to filename validation tests with `afterAll` block to prevent data accumulation

## 2025-07-22 19:45

- **Fixed Region Reporting in Search:**
  - Removed fallback to DEFAULT_REGION in search response
  - Region is now always the actual region passed from handlers
  - Made region parameter required in all DO methods for type safety
  - This ensures search responses accurately report the region where the query was executed

## 2025-07-22 19:40

- **Removed Region Info from Text Search:**
  - Removed "Search executed in region" line from search.txt responses
  - Text search results now only show content and pagination info
  - Region information still available in JSON search responses
  - Test snapshots updated to reflect the cleaner text output

## 2025-07-22 19:11

- **Fixed Region Detection in Durable Objects:**
  - Removed incorrect code that tried to parse DO ID as string with split()
  - Region is now passed from handlers to DO methods and stored in `doRegion` field
  - All DO methods now accept optional region parameter and store it
  - This ensures the DO knows its actual region for accurate reporting in search responses
  - Test snapshots updated to show correct region (weur) in all responses

## 2025-07-22 19:08

- **Simplified Region Reporting in Search:**
  - Search methods now use the DO's stored `doRegion` field instead of extracting from ID
  - Removed region parameter from `searchSections` and `searchSectionsText` methods
  - Handlers no longer need to pass region to DO methods
  - More reliable region detection using the same source as dataset creation
  - Test snapshots updated to reflect region changes (weur → wnam in test environment)

## 2025-07-22 19:05

- **Improved Region Detection in Durable Objects:**
  - Durable Objects now extract their actual region from their ID (format: region.index.datasetId)
  - When creating a new dataset in SQL storage, DO uses its actual region instead of DEFAULT_REGION
  - This ensures consistency between the DO's location and the stored region metadata
  - The DO parses its ID string to extract the region prefix for accurate region tracking

## 2025-07-22 19:03

- **Added Region Information to Search Responses:**
  - Added `region` field to search response schema to show which DO region executed the search
  - JSON search responses now include `"region": "weur"` (or appropriate region)
  - Text search responses show `*Search executed in region: weur*` at the bottom
  - Helpful for debugging regional distribution and verifying correct routing
  - All test snapshots updated to include region information
  - Region is passed through from handlers to DO methods for accurate reporting

## 2025-07-22 19:00

- **Improved API Design with Object Arguments:**
  - Refactored `getDatasetConfig` to use object arguments for better API ergonomics
  - Created `getDurableObjectId` helper function with object arguments
  - Added `orgId` to `DatasetConfig` type - now stored in KV alongside primaryRegion
  - Updated all DO stub creation to pass `locationHint` for optimal regional routing
  - This ensures Durable Objects are accessed from the preferred region for better performance
  - All tests passing with the new implementation

## 2025-07-22 18:57

- **Refactored Region Management:**
  - Removed `primaryRegion` parameter from upsert API - regions are now automatically assigned on first access
  - Added `DEFAULT_REGION` constant set to 'wnam' for consistent default handling
  - Updated `getDatasetConfig` to automatically create KV entries with region based on request location
  - Region assignment is now permanent - once set for a dataset, it cannot be changed via the upsert API
  - Simplified all API handlers to assume primaryRegion is always defined from config
  - Removed the exported `UpsertFilesRequest` type as primaryRegion is no longer part of the API
  - Updated README to reflect automatic region assignment behavior

## 2025-07-22 18:48

- **Improved Regional Distribution Implementation:**
  - Refactored `getHint` to `getClosestDurableObjectRegion` with object parameter for better API design
  - Created `DatasetConfig` type and centralized KV access through `getDatasetConfig` method
  - KV now stores JSON objects `{primaryRegion: string}` instead of plain strings for extensibility
  - Added protection against overwriting existing dataset regions - only updates KV if not already set
  - Removed deprecated `RepoCache` class and added migration to delete existing instances
  - Created EYECREST_KV namespace with ID `9649f14cc86246718a5bc00c1d23233a`
  - All tests passing with new regional distribution system

## 2025-07-22 18:10

- **Added Regional Distribution for Datasets:**
  - Datasets are now distributed across Cloudflare's Durable Object regions for optimized performance
  - Added `getHint` function to automatically determine closest DO region based on request location (continent, latitude, longitude)
  - Updated datasets table schema to include `primary_region` field
  - Added EYECREST_KV binding in wrangler.jsonc for storing dataset-to-region mappings
  - Updated Durable Object ID format to `{region}.{index}.{datasetId}` (e.g., `wnam.0.my-dataset`)
  - Index field (currently always 0) reserved for future sharding capabilities
  - Added optional `primaryRegion` parameter to upsert API for explicit region selection
  - All API operations now use KV to lookup dataset region before accessing Durable Object
  - Supported regions: wnam, enam (North America), weur, eeur (Europe), apac, me (Asia), sam (South America), oc (Oceania), afr (Africa)
  - Default fallback region is wnam (Western North America) for unknown locations
  - Updated README with regional distribution documentation

## 2025-07-22 18:02

- **Frontmatter section slug changed to empty string:**
  - Changed frontmatter sections to have `sectionSlug: ''` instead of `'frontmatter'`
  - This ensures frontmatter sections are stored with empty slug in the database
  - Updated all tests to expect empty string for frontmatter section slugs
  - No changes to search functionality - frontmatter still has higher weight (1.3)

## 2025-07-22 17:45

- **Security enhancement - Removed user-provided SHA field:**
  - Completely removed SHA field from FileSchema (breaking change)
  - SHA is now always computed server-side and never exposed in upload API
  - Removed SHA validation logic that compared user SHA with computed SHA
  - SHA is still computed and stored internally, returned in getFile responses
  - This prevents any potential SHA spoofing attacks
  - Updated tests to reflect that user cannot provide SHA values

## 2025-07-22 16:26

- **Renamed File type to EyecrestFile:**
  - Renamed exported type from `File` to `EyecrestFile` to avoid conflicts with built-in File type
  - SDK now re-exports `EyecrestFile` and `SearchSectionsResponse` types for convenience
  - Updated documentation to show type import example

## 2025-07-22 16:23

- **Fixed weight field type in SDK:**
  - Changed File type export to use `z.input` instead of `z.infer` to properly handle optional fields with defaults
  - Weight field is now correctly optional in TypeScript types when uploading files
  - Updated tests to verify weight field is optional

## 2025-07-22 16:20

- **Updated SDK Client:**
  - Removed `searchText` method and replaced with `returnAsText` parameter in `search` method
  - Added TypeScript overloads for proper return type inference based on `returnAsText` value
  - Updated tests to use real worker server instead of mocking fetch
  - Replaced all `toBe` expects with inline snapshots for better test maintainability
  - When `returnAsText` is true, returns formatted markdown text; otherwise returns JSON response

## 2025-07-22 16:05

- **Added TypeScript SDK Client:**
  - Created `EyecrestClient` class in `src/sdk.ts` for easy API integration
  - Constructor accepts object with `token` (required) and `baseUrl` (optional)
  - Implements all API methods: `upsertFiles`, `deleteFiles`, `getFile`, `search`
  - Throws errors on non-OK responses with detailed error messages
  - Exports inferred types (not schemas) from worker for type-safe usage
  - Added package.json exports for easy import: `import { EyecrestClient } from 'eyecrest/sdk'`
  - Full test coverage for SDK functionality
  - Documentation in `docs/sdk.md`

## 2025-07-22 15:53

- **Improved Search Performance by Removing Count Query:**
  - Removed the separate COUNT query from search operations
  - Changed search response from `count` field to `hasNextPage` boolean
  - Now fetches N+1 results to determine if there's a next page
  - This eliminates one database query per search, improving performance
  - Updated all test snapshots to use `hasNextPage` instead of `count`
  - Text search endpoint now shows "More results available on page X" when hasNextPage is true

## 2025-07-22 15:45

- **Simplified Database Schema and Improved Search Scoring:**
  - Simplified sections table by removing `heading` and `is_frontmatter` columns
  - Sections now store full markdown content including heading
  - Added `headingSlug` field to Section interface for URL generation
  - Implemented logarithmic weight normalization for better search relevance
  - BM25 score is now the primary signal with weights providing minor boosts
  - Formula: `BM25 × (1.0 + LOG(section_weight) × 0.1) × (1.0 + LOG(file_weight) × 0.1)`
  - This ensures BM25 relevance dominates while weights provide subtle influence
  - Frontmatter weight reduced from 2.0 to 1.3 for better balance
  - Removed section hash fragments from search.txt URLs for cleaner output
  - All tests updated and passing with new schema

## 2025-07-22 15:30

- **Frontmatter Support and Weight-based Ranking:**
  - Added frontmatter parsing support for markdown files
  - Frontmatter is now recognized as its own section with empty heading
  - Added weight support for both files and individual sections
  - Files can have a weight property (default 1.0) to influence search ranking
  - Frontmatter sections have higher default weight (1.3) for better ranking
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