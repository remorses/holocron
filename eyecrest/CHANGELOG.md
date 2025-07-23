# Changelog

## 2025-07-23 15:37

- **Renamed Durable Object from DatasetCache to Datasets:**
  - Renamed binding from `DATASET_CACHE` to `DATASETS` for better clarity
  - Renamed class from `DatasetCache` to `Datasets` to better reflect its purpose
  - Updated all references in worker.ts to use new names
  - Added migration v5 in wrangler.jsonc to rename the Durable Object class
  - This change better reflects that the DO manages datasets, not a cache
  - All tests passing with the new naming convention

## 2025-07-23 15:32

- **Refactored SDK API to Use Single Object Parameters:**
  - All SDK methods now use a single object parameter that includes datasetId
  - `upsertDataset` now takes `{ datasetId, ...options }` instead of `(datasetId, options)`
  - Consistent API design across all methods for better ergonomics
  - Updated documentation to reflect new object parameter pattern
  - Added `upsertDataset` method to SDK for dataset creation with regional options
  - All method signatures now follow the same pattern for consistency

## 2025-07-23 15:20

- **Added Data Synchronization for New Replica Regions:**
  - When adding replica regions to an existing dataset, all existing data is now automatically synced
  - Added `getAllData` method to export all files from primary DO
  - Added `syncFromPrimary` method to import data into replica DOs
  - Fixed serialization issue by passing region ID instead of stub object
  - Added `waitForReplication` parameter to dataset upsert (default: true)
  - When true, waits for sync to complete before returning
  - When false, sync happens asynchronously using waitUntil
  - Added comprehensive tests for replica synchronization scenarios

## 2025-07-23 13:10

- **Updated Test Documentation:**
  - Added CLAUDE.md note explaining test files must be run atomically
  - Cannot use -t flag for individual test isolation in certain files
  - production.test.ts and sdk.test.ts have interdependent tests
  - Tests within these files are designed to run sequentially
  - Later tests depend on data uploaded by earlier tests

## 2025-07-23 13:00

- **Removed getDurableObjectIdForDO Function:**
  - Consolidated to use only `getDurableObjectId` for consistency
  - Removed duplicate helper function that was doing the same thing
  - All DO ID generation now uses the same function

- **Changed Timestamp Rounding from 5 to 2 Minutes:**
  - Test dataset IDs now round to nearest 2 minutes instead of 5
  - Provides more granular test isolation
  - Reduces chance of test conflicts when running frequently

- **Updated Tests to Use waitForReplication Parameter:**
  - Replaced manual sleep/setTimeout with `waitForReplication` parameter
  - Tests now explicitly control whether to wait for replication
  - More reliable and faster test execution
  - Clear intent in tests about replication behavior

## 2025-07-23 12:00

- **Fixed Replication Region Forwarding Bug:**
  - Fixed critical bug where primary was passing its own region instead of replica's region
  - When forwarding upsertFiles/deleteFiles to replicas, now correctly passes the replica's region
  - This was causing region mismatch errors and preventing replication from working
  - All replication tests now pass successfully
  - Data written to primary region is correctly replicated to all configured replicas

## 2025-07-23 11:45

- **Fixed Fire-and-Forget Operations to Use waitUntil:**
  - All async operations in Durable Objects now properly use `this.state.waitUntil`
  - Added `state` property to DO class and set it in constructor
  - Replica creation in `upsertDataset` now uses waitUntil
  - Replication forwarding with `waitForReplication: false` uses waitUntil
  - This ensures async operations complete even if the DO request finishes
  - Prevents dropped operations and ensures data consistency

- **Added DELETE /v1/datasets/:datasetId Route:**
  - New route to delete entire datasets including all files and metadata
  - Deletes from primary DO, which cascades deletion to all replicas
  - Also removes dataset configuration from KV storage
  - Verifies ownership before deletion
  - Replicas are deleted asynchronously using waitUntil

- **Updated All Tests to Delete Datasets Instead of Individual Files:**
  - Tests now use the new DELETE dataset route in afterAll blocks
  - Removed file tracking arrays and individual file deletions
  - Cleaner test cleanup that ensures complete removal of test data
  - More efficient than deleting files one by one

## 2025-07-23 11:30

- **Removed DO ID Parsing and Enforced Strict Region Handling:**
  - Removed all code that tried to extract region from Durable Object ID
  - DO IDs are random strings and should not be parsed for information
  - `doRegion` is now only set in constructor (from SQLite) or in `upsertDataset`
  - All methods now throw errors if `doRegion` or `datasetId` is null
  - Removed DEFAULT_REGION fallbacks - operations fail fast if region not properly set
  - This ensures data integrity and prevents silent failures

- **Added waitForReplication Parameter to Write Operations:**
  - Added `waitForReplication` boolean parameter to upsertFiles and deleteFiles APIs
  - Defaults to `true` for backward compatibility
  - When `true`, primary DO waits for replication to complete before returning
  - When `false`, replication happens asynchronously (fire-and-forget)
  - Useful for high-throughput scenarios where eventual consistency is acceptable
  - Replica operations always use `waitForReplication: false` to prevent cascading waits

- **Added x-force-region Header for Testing:**
  - New `x-force-region` header allows forcing requests to specific DO regions
  - Only works for regions that actually have the dataset (primary or replicas)
  - Returns error if trying to force a region without the dataset
  - Essential for testing replication and verifying data availability
  - Works with all read operations: getFile, search, searchText

- **Created Comprehensive Replication Tests:**
  - New test file `replication.test.ts` dedicated to replication scenarios
  - Tests writing to primary and reading from replicas
  - Verifies x-force-region header functionality
  - Tests async replication with waitForReplication=false
  - Confirms delete operations propagate to all replicas
  - Ensures data consistency across regions

## 2025-07-23 11:00

- **Replaced is_primary Flag with DO Region Validation:**
  - Removed `is_primary` column from datasets table, replaced with `do_region`
  - Each DO now extracts its region from its ID and stores it in the database
  - Primary status is determined by comparing DO region with primary_region in database
  - Added validation to throw errors if DO region cannot be determined
  - All region mismatches now throw descriptive errors
  - Ensures data integrity by validating DO location matches expected region

- **Async Replica Operations:**
  - All replica forwarding operations now run asynchronously without blocking
  - Primary DO no longer waits for replica writes to complete
  - Replica operations are fire-and-forget with error logging
  - Improves write latency as clients don't wait for replication
  - Errors in replica operations are logged but don't fail the primary write
  - Note: waitUntil cannot be used in DOs when calling methods via stubs

## 2025-07-23 10:40

- **Implemented Smart Regional Read Routing:**
  - Added `getClosestAvailableRegion` helper to determine the best region for requests
  - Read operations (getFileContents, searchSections) now use the closest available region
  - If request originates from a region with a replica, it uses that replica for reads
  - Write operations continue to always use the primary region
  - This improves read latency by serving data from the nearest Durable Object
  - Fully implements the replication architecture where writes go to primary and reads use closest region

## 2025-07-23 10:35

- **Fixed Test Suite to Handle Explicit Dataset Creation:**
  - Added `beforeAll` blocks to create test datasets before running file operations
  - Fixed import statements to include `beforeAll` from vitest
  - Removed env parameter from DO methods to fix serialization errors
  - All tests now passing with the new requirement for explicit dataset creation

## 2025-07-23 10:30

- **Simplified Dataset Management and Replication Architecture:**
  - Renamed `regions` to `replicaRegions` throughout codebase for clarity
  - Added `VALID_REGIONS` constant and `DurableObjectRegion` type to avoid string duplication
  - Created explicit `setDatasetConfig` function - config is no longer auto-created
  - Removed auto-creation of datasets on file upload - datasets must be explicitly created first
  - Moved replica DO creation from worker to primary DO's `upsertDataset` method
  - Primary DO now handles all replica creation, making the system more resilient
  - Worker no longer needs to manage replica creation logic
  - Simplified error handling - all routes now throw if dataset doesn't exist
  - Primary region detection now uses typed `DurableObjectRegion` instead of generic strings

## 2025-07-22 20:00

- **Added Explicit Dataset Creation Route:**
  - New `POST /v1/datasets/:datasetId` route to create datasets with explicit region
  - Request body accepts `primaryRegion` to specify the Durable Object region
  - Primary region is immutable - attempts to change it will fail with an error
  - Route is idempotent - safe to call multiple times with the same parameters
  - All KV operations moved to the worker's `getDatasetConfig` function
  - DO's `upsertDataset` method only handles SQL operations
  - If region not provided, uses closest region based on request geolocation

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