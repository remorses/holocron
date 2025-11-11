---
title: File to Database Sync Flow
description: How sync.ts processes files from GitHub or filesInDraft and syncs them to the database
prompt: |
  Document the sync.ts file from @website/src/lib/sync.ts. Explain AssetForSync types, assetsFromFilesList
  generator, syncSite function with semaphore concurrency control, how it processes different asset types
  (pages, media, meta files, docsJson, styles.css), githubSha deduplication, Search API integration,
  cache tag invalidation, and the processGeneratorConcurrentlyInOrder pattern. Include GitHub sync flow.
---

# File to Database Sync Flow

The `sync.ts` module handles the critical task of importing content from GitHub repositories or in-memory drafts into the database. It processes various file types, manages deduplication, and maintains consistency.

## Asset Types

### AssetForSync Union Type
```typescript
type AssetForSync =
    | {
        type: 'page'
        totalPages: number
        markdown: string
        githubPath: string
        githubSha: string
    }
    | {
        type: 'mediaAsset'
        githubSha: string
        downloadUrl: string
        githubPath: string
        width?: number
        height?: number
        bytes?: number
    }
    | {
        type: 'metaFile'
        content: string
        githubPath: string
        githubSha: string
    }
    | {
        type: 'docsJson'
        content: string
        githubPath: string
        githubSha: string
    }
    | {
        type: 'stylesCss'
        content: string
        githubPath: string
        githubSha: string
    }
    | {
        type: 'deletedAsset'
        githubPath: string
    }
```

## File Processing Pipeline

### 1. Asset Generation
The `assetsFromFilesList` generator function:
```typescript
async function* assetsFromFilesList({
    files,
    docsJson,
    docsJsonComments,
    githubFolder
}): AsyncGenerator<AssetForSync> {
    // 1. Process meta.json files first
    for (const file of metaFiles) {
        yield { type: 'metaFile', ... }
    }
    
    // 2. Yield holocron.jsonc configuration
    if (docsJson !== undefined) {
        yield { type: 'docsJson', ... }
    }
    
    // 3. Process styles.css
    if (stylesCssFile) {
        yield { type: 'stylesCss', ... }
    }
    
    // 4. Process media assets
    for (const file of mediaFiles) {
        yield { type: 'mediaAsset', ... }
    }
    
    // 5. Process markdown/MDX pages
    for (const file of markdownFiles) {
        yield { type: 'page', ... }
    }
}
```

### 2. SHA Calculation
Git blob SHA for deduplication:
```typescript
function gitBlobSha(content: string | Buffer): string {
    const body = Buffer.isBuffer(content) 
        ? content 
        : Buffer.from(content, 'utf8')
    
    // Git header format: "blob <size>\0"
    const header = Buffer.from(`blob ${body.length}\0`, 'utf8')
    
    return createHash('sha1')
        .update(Buffer.concat([header, body]))
        .digest('hex')
}
```

## Main Sync Function

### syncSite Function
```typescript
async function syncSite({
    branchId,
    siteId,
    files,  // AsyncIterable<AssetForSync>
    githubFolder,
    signal
}) {
    const concurrencyLimit = 10
    const semaphore = new Sema(concurrencyLimit)
    
    // Process files concurrently with order preservation
    for await (const chunks of processGeneratorConcurrentlyInOrder(
        files,
        concurrencyLimit,
        async (asset) => {
            await semaphore.acquire()
            try {
                switch (asset.type) {
                    case 'metaFile':
                        return await syncMetaFile(asset)
                    case 'docsJson':
                        return await syncDocsJson(asset)
                    case 'stylesCss':
                        return await syncStylesCss(asset)
                    case 'mediaAsset':
                        return await syncMediaAsset(asset)
                    case 'page':
                        return await syncPage(asset)
                    case 'deletedAsset':
                        return await syncDeletedAsset(asset)
                }
            } finally {
                semaphore.release()
            }
        }
    )) {
        allFilesToSync.push(...chunks)
    }
}
```

## Asset Type Processors

### Page Processing
```typescript
async function syncPage(asset: AssetForSync) {
    // 1. Parse MDX/Markdown
    const result = await processMdxInServer({
        markdown: asset.markdown,
        githubPath: asset.githubPath,
        extension: extension
    })
    
    // 2. Extract metadata
    const pageInput = {
        slug: slug,
        branchId,
        frontmatter: result.data.frontmatter,
        githubPath: asset.githubPath,
        githubSha: asset.githubSha
    }
    
    // 3. Atomic transaction for consistency
    await prisma.$transaction([
        // Upsert page
        prisma.markdownPage.upsert({
            where: { branchId_slug: { branchId, slug } },
            update: pageInput,
            create: { ...pageInput, branchId }
        }),
        // Create/update content blob (deduplicated)
        prisma.markdownBlob.upsert({
            where: { githubSha: asset.githubSha },
            update: {
                markdown,
                mdast,
                structuredData
            },
            create: {
                githubSha: asset.githubSha,
                markdown,
                mdast,
                structuredData
            }
        })
    ])
    
    // 4. Handle relations (errors, media assets)
    await prisma.$transaction([
        prisma.markdownPageSyncError.deleteMany({ where: { pageId } }),
        prisma.pageMediaAsset.deleteMany({ where: { pageId } }),
        ...errors.map(error => 
            prisma.markdownPageSyncError.create({ data: { ... } })
        ),
        ...relativeImagesSlugs.map(imageSrc =>
            prisma.pageMediaAsset.create({ data: { ... } })
        )
    ])
}
```

### Media Asset Processing
```typescript
async function syncMediaAsset(asset: AssetForSync) {
    // 1. Download and upload to S3
    const buffer = await downloadFromUrl(asset.downloadUrl)
    
    // 2. Extract metadata for images
    if (isImage) {
        const dimensions = imageDimensionsFromData(buffer)
        metadata.width = dimensions.width
        metadata.height = dimensions.height
    }
    
    // 3. Upload to S3
    await uploadToS3(buffer, key, contentType)
    
    // 4. Store in database
    await prisma.mediaAsset.upsert({
        where: { slug_branchId: { branchId, slug } },
        update: { width, height, bytes },
        create: { githubSha, slug, githubPath, branchId, width, height, bytes }
    })
}
```

### Configuration Processing
```typescript
async function syncDocsJson(asset: AssetForSync) {
    const { data: jsonData, comments } = extractJsonCComments(asset.content)
    
    // 1. Update branch configuration
    await prisma.siteBranch.update({
        where: { branchId },
        data: { docsJson: jsonData, docsJsonComments: comments }
    })
    
    // 2. Update site name if defined
    if (jsonData.name) {
        await prisma.site.update({
            where: { siteId },
            data: { name: jsonData.name }
        })
    }
    
    // 3. Handle domain connections
    if (jsonData.domains) {
        // Add new domains, remove old ones
        await manageDomains(jsonData.domains)
    }
}
```

## Concurrency Control

### Semaphore Pattern
```typescript
const semaphore = new Sema(concurrencyLimit)

await semaphore.acquire()  // Wait for slot
try {
    // Do work
} finally {
    semaphore.release()     // Free slot
}
```

### Order Preservation
`processGeneratorConcurrentlyInOrder` ensures:
1. Files processed concurrently (up to limit)
2. Results yielded in original order
3. Backpressure handling for large datasets

## GitHub Integration

### Fetching from GitHub
```typescript
async function* filesFromGithub({
    repo,
    owner,
    installationId,
    branchId,
    basePath,
    forceFullSync
}) {
    const octokit = await getOctokit({ installationId })
    
    // Get existing content for deduplication
    const existingPages = await prisma.markdownPage.findMany({ where: { branchId } })
    const existingPathsPlusSha = new Set(
        existingPages.map(f => f.githubPath + f.githubSha)
    )
    
    // Fetch files with smart filtering
    const files = await getRepoFiles({
        fetchBlob(file) {
            // Skip if unchanged (same SHA)
            if (existingPathsPlusSha.has(file.path + file.sha)) {
                return false
            }
            return true
        },
        branch,
        octokit,
        owner,
        repo
    })
    
    // Yield assets for processing
    for (const file of files) {
        yield convertToAsset(file)
    }
}
```

## Search API Integration

### Indexing Content
```typescript
// Collect files for search indexing
const filesToSync: SearchApiFile[] = []

// During page processing
filesToSync.push({
    filename: asset.githubPath,
    content: asset.markdown,
    metadata: {
        title: data.frontmatter.title,
        slug: slug,
        frontmatter: data.frontmatter
    },
    weight: 1.0
})

// After all processing
await searchApi.upsertFiles({
    datasetId: branchId,
    files: filesToSync
})
```

### Deletion Handling
```typescript
// Track deleted files
const deletedFilenames: string[] = []

// Process deletions
await searchApi.deleteFiles({
    datasetId: branchId,
    filenames: deletedFilenames
})
```

## Cache Management

### Cache Tag Generation
```typescript
function getCacheTagForPage({ branchId, slug }) {
    return `page:${branchId}:${slug}`
}

function getCacheTagForMediaAsset({ branchId, slug }) {
    return `asset:${branchId}:${slug}`
}
```

### Cache Invalidation
```typescript
const cacheTagsToInvalidate: string[] = []

// During processing
cacheTagsToInvalidate.push(getCacheTagForPage({ branchId, slug }))

// After sync complete
await cloudflareClient.invalidateCacheTags(cacheTagsToInvalidate)
```

## Error Handling

### Parse Error Management
```typescript
try {
    const result = await processMdxInServer({ markdown, githubPath })
} catch (error) {
    // Store error for display
    errors.push({
        errorMessage: error.message,
        line: error.line || 1,
        errorType: extension === 'mdx' ? 'mdxParse' : 'mdParse'
    })
    
    // Set githubSha to null for error pages
    effectiveGithubSha = null
}
```

### Transaction Rollback
All database operations use transactions:
```typescript
await prisma.$transaction([
    // All operations succeed or all fail
    operation1,
    operation2,
    operation3
])
```

## Performance Optimizations

### Deduplication Check
- Compare githubSha before fetching content
- Skip unchanged files during incremental sync
- Share MarkdownBlobs between identical pages

### Parallel Processing
- Process up to 10 assets concurrently
- Media downloads in parallel
- Database operations batched in transactions

### Memory Management
- Stream large files instead of loading to memory
- Process files as generator (lazy evaluation)
- Release semaphore slots promptly

## Sync Triggers

### Manual Sync
- User initiates from UI
- Full or incremental based on changes

### Auto Sync
- After chat completion
- On GitHub webhook events
- Scheduled syncs for active sites

### Draft to Database
- Chat completion triggers sync
- filesInDraft merged into database
- Search index updated