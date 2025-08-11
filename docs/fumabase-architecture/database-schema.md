---
title: Database Schema for Content Storage
description: Detailed explanation of Prisma database schema for pages, media assets, meta files, and related tables
prompt: |
  Document the database schema from db/schema.prisma for MarkdownPage, MarkdownBlob, MediaAsset, MetaFile,
  SiteBranch, Chat, and related tables. Explain relationships, the githubSha deduplication strategy,
  how content is stored separately in MarkdownBlob, and how the schema supports versioning and branches.
  Include cascade deletes, unique constraints, and the role of each table in the system.
---

# Database Schema for Content Storage

Fumabase uses PostgreSQL with Prisma ORM to manage content storage. The schema is designed for efficient content deduplication, version control, and multi-branch support.

## Core Content Tables

### MarkdownPage
Stores page metadata and references to content:
```prisma
model MarkdownPage {
    pageId      String   @id @default(cuid())
    slug        String   // URL path like "/getting-started"
    githubPath  String   // File path in repo
    githubSha   String?  // Git blob SHA for deduplication
    branchId    String   // Which branch this belongs to
    frontmatter Json     // Parsed frontmatter metadata
    
    // Relations
    branch      SiteBranch      @relation(...)
    content     MarkdownBlob?   @relation(...)  // Actual content
    errors      MarkdownPageSyncError[]
    mediaAssets PageMediaAsset[]
    
    @@unique([branchId, slug])
    @@index([githubSha])
}
```

### MarkdownBlob
Stores actual markdown content (deduplicated by SHA):
```prisma
model MarkdownBlob {
    githubSha       String   @id  // Git SHA as primary key
    markdown        String   // Raw markdown content
    mdast           Json     // Parsed AST
    structuredData  Json     // Extracted headings, content
    
    // Relations
    pages           MarkdownPage[]  // Multiple pages can share content
}
```

**Deduplication Strategy**: Multiple pages with identical content share the same MarkdownBlob, identified by githubSha.

### MediaAsset
Stores images and other media files:
```prisma
model MediaAsset {
    assetId     String   @id @default(cuid())
    slug        String   // URL path for the asset
    githubPath  String   // Original file path
    githubSha   String   // Git blob SHA
    branchId    String   
    width       Int?     // Image dimensions
    height      Int?
    bytes       Int      // File size
    
    // Relations
    branch      SiteBranch       @relation(...)
    pageAssets  PageMediaAsset[]  // Pages using this asset
    
    @@unique([slug, branchId])
}
```

### MetaFile
Stores meta.json configuration files:
```prisma
model MetaFile {
    metaId      String   @id @default(cuid())
    githubPath  String   // Path to meta.json
    githubSha   String   // Git blob SHA
    jsonData    Json     // Parsed JSON content
    branchId    String
    
    // Relations
    branch      SiteBranch  @relation(...)
    
    @@unique([githubPath, branchId])
}
```

## Branch and Site Management

### Site
Root entity for a documentation website:
```prisma
model Site {
    siteId          String   @id @default(cuid())
    name            String   // Site display name
    githubFolder    String?  // Base path in repository
    defaultLocale   String   @default("en")
    createdAt       DateTime @default(now())
    
    // Relations
    org             Org             @relation(...)
    branches        SiteBranch[]    // Multiple branches
    locales         SiteLocale[]    // Supported languages
    installations   SiteInstallation[]
}
```

### SiteBranch
Represents a version/branch of the site:
```prisma
model SiteBranch {
    branchId         String   @id @default(cuid())
    siteId           String
    branch           String   // Git branch name
    docsJson         Json?    // fumabase.jsonc content
    docsJsonComments Json?    // Preserved JSONC comments
    cssStyles        String?  // Custom CSS
    
    // Relations
    site            Site            @relation(...)
    pages           MarkdownPage[]
    mediaAssets     MediaAsset[]
    metaFiles       MetaFile[]
    domains         Domain[]        // Custom domains
    chats           Chat[]          // AI chat sessions
    
    @@unique([siteId, branch])
}
```

## Chat and Editing System

### Chat
Stores AI chat sessions and draft files:
```prisma
model Chat {
    chatId          String   @id
    userId          String
    branchId        String
    currentSlug     String   // Current page being edited
    filesInDraft    Json     // In-memory file changes
    lastPushedFiles Json     // Last synced state
    title           String?  // Generated chat title
    description     String?  // PR description
    prNumber        Int?     // GitHub PR number
    modelId         String?  // AI model used
    modelProvider   String?
    createdAt       DateTime @default(now())
    
    // Relations
    user            User            @relation(...)
    branch          SiteBranch      @relation(...)
    messages        ChatMessage[]   // Chat history
}
```

### ChatMessage
Individual messages in a chat:
```prisma
model ChatMessage {
    id          String   @id
    chatId      String
    role        String   // "user" or "assistant"
    index       Int      // Message order
    createdAt   DateTime @default(now())
    
    // Relations
    chat        Chat              @relation(...)
    textParts   ChatPartText[]    // Text content
    toolParts   ChatPartTool[]    // Tool invocations
    reasoning   ChatPartReasoning[] // AI reasoning
    files       ChatPartFile[]    // File attachments
}
```

### ChatPart Tables
Different types of message content:
```prisma
model ChatPartText {
    partId      String   @id @default(cuid())
    messageId   String
    index       Int      // Order within message
    type        String   // "text"
    text        String   // Actual text content
}

model ChatPartTool {
    partId      String   @id @default(cuid())
    messageId   String
    index       Int
    type        String   // Tool type
    toolCallId  String   // Unique tool invocation ID
    state       String   // "output-available", "output-error"
    input       Json     // Tool parameters
    output      Json?    // Tool result
    errorText   String?  // Error message if failed
}
```

## Error Tracking

### MarkdownPageSyncError
Tracks parsing/compilation errors:
```prisma
model MarkdownPageSyncError {
    errorId      String   @id @default(cuid())
    pageId       String
    line         Int      // Error line number
    errorMessage String   // Error description
    errorType    String   // "mdxParse", "mdParse", "render"
    
    // Relations
    page         MarkdownPage  @relation(...)
}
```

## Relationships and Constraints

### Junction Tables

#### PageMediaAsset
Links pages to media they reference:
```prisma
model PageMediaAsset {
    pageId      String
    assetSlug   String
    branchId    String
    
    // Relations
    page        MarkdownPage  @relation(...)
    mediaAsset  MediaAsset    @relation(...)
    
    @@id([pageId, assetSlug, branchId])
}
```

### Cascade Deletes
- Deleting a `Site` cascades to all `SiteBranch` records
- Deleting a `SiteBranch` cascades to all pages, assets, and chats
- Deleting a `Chat` cascades to all messages and parts
- Deleting a `MarkdownPage` cascades to sync errors and asset links

### Unique Constraints
- `MarkdownPage`: Unique on `[branchId, slug]`
- `MediaAsset`: Unique on `[slug, branchId]`
- `MetaFile`: Unique on `[githubPath, branchId]`
- `MarkdownBlob`: Primary key is `githubSha` (ensures deduplication)

## Data Flow Patterns

### Content Creation
1. File uploaded/synced → Calculate githubSha
2. Check if MarkdownBlob exists with that SHA
3. If not, create new MarkdownBlob with parsed content
4. Create/update MarkdownPage pointing to blob

### Content Updates
1. New content → Calculate new githubSha
2. Find or create MarkdownBlob
3. Update MarkdownPage to point to new blob
4. Old blob remains if other pages use it

### Branch Operations
1. Each branch has independent pages/assets
2. Branches can share MarkdownBlobs (same content)
3. Merging branches involves copying page references

## Performance Optimizations

### Indexes
- `githubSha` on MarkdownPage for quick lookups
- `branchId` on all content tables for filtering
- `slug` fields for URL routing

### Deduplication Benefits
- Identical content stored once
- Efficient storage for documentation with repeated sections
- Fast comparisons using SHA hashes

### Lazy Loading
- MarkdownBlob loaded only when content needed
- Frontmatter available without loading full content
- Media dimensions stored to avoid loading files

## Migration Considerations

### Schema Evolution
- Use Prisma migrations for schema changes
- Preserve githubSha values during migrations
- Maintain referential integrity

### Data Cleanup
- Orphaned MarkdownBlobs can be garbage collected
- Unused MediaAssets identified by missing PageMediaAsset links
- Old chat sessions can be archived/deleted