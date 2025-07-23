# Eyecrest SDK

TypeScript SDK for the Eyecrest API - a markdown file search and indexing service powered by SQLite FTS5.

## Installation

```bash
npm install eyecrest
# or
pnpm add eyecrest
```

## Usage

```typescript
import { EyecrestClient, type EyecrestFile, type UpsertDatasetRequest } from 'eyecrest/sdk';

// Initialize the client
const client = new EyecrestClient({
  token: 'your-jwt-token',
  baseUrl: 'https://eyecrest.org' // optional, defaults to https://eyecrest.org
});

// Create a dataset
await client.upsertDataset({
  datasetId: 'my-dataset-123',
  primaryRegion: 'wnam', // optional, defaults to closest region
  replicaRegions: ['enam', 'weur'], // optional
  waitForReplication: true // optional, default true
});

// Upload markdown files
await client.upsertFiles({
  datasetId: 'my-dataset-123',
  files: [
    {
      filename: 'README.md',
      content: '# My Project\n\nThis is my project documentation.',
      weight: 1.5 // optional, affects search ranking
    },
    {
      filename: 'docs/api.md',
      content: '# API Reference\n\n## Endpoints\n\n...',
      metadata: { // optional metadata
        author: 'John Doe',
        version: '1.0.0'
      }
    }
  ]
});

// Search for content
const results = await client.search({
  datasetId: 'my-dataset-123',
  query: 'API endpoints',
  page: 0,
  perPage: 20,
  maxChunksPerFile: 5,
  snippetLength: 300
});

console.log(`Found ${results.results.length} results`);
console.log(`Has more pages: ${results.hasNextPage}`);

// Get search results as formatted text
const textResults = await client.search({
  datasetId: 'my-dataset-123',
  query: 'installation',
  returnAsText: true
});
console.log(textResults);

// Retrieve a specific file
const file = await client.getFile({
  datasetId: 'my-dataset-123',
  filePath: 'README.md'
});
console.log(file.content);
console.log(file.sha);

// Retrieve file with line numbers
const fileWithLines = await client.getFile({
  datasetId: 'my-dataset-123',
  filePath: 'docs/api.md',
  showLineNumbers: true,
  start: 10,
  end: 20
});

// Delete files
await client.deleteFiles({
  datasetId: 'my-dataset-123',
  filenames: ['old-file.md', 'deprecated.md']
});
```

## API Methods

### `constructor({ token, baseUrl? })`
Creates a new client instance.
- `token`: JWT authentication token (required)
- `baseUrl`: API base URL (optional, defaults to `https://eyecrest.org`)

### `upsertDataset(params)`
Create or update a dataset with regional distribution.
- `params`: Object containing:
  - `datasetId`: Unique identifier for your dataset
  - `primaryRegion`: Optional primary DO region (default: closest to request)
  - `replicaRegions`: Optional array of replica regions
  - `waitForReplication`: Optional, wait for replicas to sync (default: true)

### `upsertFiles(params)`
Upload or update markdown files. Files are automatically parsed into sections for search.
- `params`: Object containing:
  - `datasetId`: Unique identifier for your dataset
  - `files`: Array of file objects with:
    - `filename`: File path (e.g., 'docs/readme.md')
    - `content`: Markdown content
    - `metadata`: Optional metadata object
    - `weight`: Optional weight for search ranking (default: 1.0)

### `search(params)`
Search within markdown sections.
- `params`: Object containing:
  - `datasetId`: Dataset to search in
  - `query`: Full-text search query
  - `page`: Page number (default: 0)
  - `perPage`: Results per page (default: 20)
  - `maxChunksPerFile`: Max sections per file (default: 5)
  - `snippetLength`: Snippet length (default: 300, max: 500)
  - `returnAsText`: Return formatted text instead of JSON (default: false)

Returns (when `returnAsText` is false or omitted):
```typescript
{
  results: Array<{
    filename: string
    sectionSlug: string
    snippet: string
    cleanedSnippet: string
    score: number
    startLine: number
    metadata?: any
  }>
  hasNextPage: boolean
  page: number
  perPage: number
}
```

Returns (when `returnAsText` is true):
Formatted markdown text with search results.

### `getFile(params)`
Retrieve a file's content.
- `params`: Object containing:
  - `datasetId`: Dataset containing the file
  - `filePath`: Path to the file
  - `showLineNumbers`: Add line numbers (default: false)
  - `start`: Start line (1-based)
  - `end`: End line (inclusive)

Returns:
```typescript
{
  content: string
  sha: string
  metadata?: any
}
```

### `deleteFiles(params)`
Delete files from a dataset.
- `params`: Object containing:
  - `datasetId`: Dataset to delete from
  - `filenames`: Array of file paths to delete

## Error Handling

All methods throw errors on non-OK responses:

```typescript
try {
  await client.search({ datasetId: 'test', query: 'foo' });
} catch (error) {
  console.error(error.message);
  // "Request failed with status 401: Unauthorized: Invalid token"
}
```

## Authentication

The SDK requires a JWT token with an `orgId` claim. Datasets are scoped to organizations - you can only access datasets belonging to your organization.

## Search Features

The search uses SQLite FTS5 with the Porter tokenizer, which provides:
- Stemming (e.g., "running" matches "run")
- Case-insensitive search
- Phrase search with quotes: `"exact phrase"`
- Boolean operators: `AND`, `OR`, `NOT`
- Prefix search: `user*`

## File Support

- Supports `.md` and `.mdx` files
- Automatically extracts and indexes frontmatter
- Splits files into sections based on headings
- Preserves markdown syntax in search results