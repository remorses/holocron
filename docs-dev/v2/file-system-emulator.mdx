---
title: FileSystemEmulator and Database-to-File Flow
description: How FileSystemEmulator provides unified file access and getPageContent retrieves content from database
prompt: |
  Document FileSystemEmulator from @website/src/lib/file-system-emulator.ts and getPageContent from
  @website/src/lib/spiceflow-generate-message.tsx. Explain how FileSystemEmulator abstracts file access,
  checking filesInDraft first then falling back to getPageContent. Show the read, write, delete, move
  operations, batch operations, and how tools use this interface. Include special handling for
  holocron.jsonc and styles.css files.
---

# FileSystemEmulator and Database-to-File Flow

The FileSystemEmulator provides a unified interface for file operations, abstracting the complexity of managing both in-memory drafts and database-persisted content. It's the key abstraction that allows AI tools to work with files seamlessly.

## FileSystemEmulator Architecture

### Core Interface
```typescript
interface FileSystemEmulatorOptions {
    filesInDraft: Record<string, FileUpdate>
    getPageContent: (githubPath: string) => Promise<string | undefined | void>
    onFilesDraftChange?: () => void | Promise<void>
}
```

### Key Responsibilities
1. **Unified Access**: Single interface for draft and persisted files
2. **Draft Priority**: Always checks `filesInDraft` before database
3. **Change Tracking**: Calculates line additions/deletions
4. **Batch Operations**: Efficient multi-file operations
5. **Change Notifications**: Triggers updates when files change

## Read Operations

### Single File Read
```typescript
async read(path: string): Promise<string | null> {
    // 1. Check draft first (highest priority)
    if (this.filesInDraft[path]) {
        return this.filesInDraft[path].content
    }
    
    // 2. Fall back to database via getPageContent
    return this.getOriginalContent(path)
}

private async getOriginalContent(path: string): Promise<string | null> {
    // Cache original content to avoid repeated DB calls
    if (this.originalContent.has(path)) {
        return this.originalContent.get(path)!
    }
    
    const content = await this.getPageContent(path)
    const contentStr = content || ''
    this.originalContent.set(path, contentStr)
    return contentStr || null
}
```

### Batch Read
```typescript
async readBatch(paths: string[]): Promise<(string | null)[]> {
    return Promise.all(paths.map(path => this.read(path)))
}
```

## Write Operations

### Single File Write
```typescript
async write(path: string, content: string): Promise<void> {
    const currentContent = await this.read(path)
    
    if (currentContent === null) {
        // New file creation
        const lineCount = content.split('\n').length
        this.filesInDraft[path] = {
            githubPath: path,
            content,
            addedLines: lineCount,
        }
    } else {
        // Update existing file
        const oldLineCount = currentContent.split('\n').length
        const newLineCount = content.split('\n').length
        this.filesInDraft[path] = {
            githubPath: path,
            content,
            addedLines: Math.max(0, newLineCount - oldLineCount),
            deletedLines: Math.max(0, oldLineCount - newLineCount),
        }
    }
    
    await this.notifyChange()
}
```

### Batch Write
```typescript
async writeBatch(files: Array<{ path: string; content: string }>): Promise<void> {
    // Process all files without intermediate notifications
    for (const { path, content } of files) {
        // ... same logic as single write but no notify
    }
    
    // Single notification after all writes
    await this.notifyChange()
}
```

## Delete Operations

### File Deletion
```typescript
async delete(path: string): Promise<void> {
    const content = await this.read(path)
    if (content === null) {
        throw new Error(`Cannot delete non-existent file: ${path}`)
    }
    
    const lineCount = content.split('\n').length
    this.filesInDraft[path] = {
        githubPath: path,
        content: null,  // null indicates deletion
        deletedLines: lineCount,
    }
    
    await this.notifyChange()
}
```

## Move Operations

### File Move/Rename
```typescript
async move(oldPath: string, newPath: string): Promise<void> {
    const content = await this.read(oldPath)
    if (content === null) {
        throw new Error(`Cannot move non-existent file: ${oldPath}`)
    }
    
    const lineCount = content.split('\n').length
    
    // Create at new location
    this.filesInDraft[newPath] = {
        githubPath: newPath,
        content,
        addedLines: lineCount,
    }
    
    // Mark old location as deleted
    this.filesInDraft[oldPath] = {
        githubPath: oldPath,
        content: null,
        deletedLines: lineCount,
    }
    
    await this.notifyChange()
}
```

## getPageContent Function

The `getPageContent` function retrieves content from the database:

### Implementation
```typescript
export async function getPageContent({ githubPath, branchId }) {
    // 1. Handle special file: holocron.jsonc
    if (githubPath.endsWith('holocron.jsonc')) {
        const branch = await prisma.siteBranch.findFirst({
            where: { branchId },
            select: { docsJson: true, docsJsonComments: true },
        })
        
        if (!branch || !branch.docsJson) {
            throw new Error(`Cannot find holocron.jsonc for branch ${branchId}`)
        }
        
        // Preserve JSONC comments if they exist
        if (branch.docsJsonComments) {
            return applyJsonCComments(
                branch.docsJson,
                branch.docsJsonComments,
                2
            )
        }
        return JSON.stringify(branch.docsJson, null, 2)
    }
    
    // 2. Handle special file: styles.css
    if (githubPath.endsWith('/styles.css') || githubPath === 'styles.css') {
        const branch = await prisma.siteBranch.findFirst({
            where: { branchId },
            select: { cssStyles: true },
        })
        return branch?.cssStyles || ''
    }
    
    // 3. Try markdown page
    const page = await prisma.markdownPage.findFirst({
        where: { branchId, githubPath },
        include: { content: true },  // Join with MarkdownBlob
    })
    if (page) {
        return page.content?.markdown || ''
    }
    
    // 4. Try meta.json file
    const metaFile = await prisma.metaFile.findFirst({
        where: { branchId, githubPath },
    })
    if (metaFile) {
        return JSON.stringify(metaFile.jsonData, null, 2)
    }
    
    // 5. File not found
    return undefined
}
```

### Special File Handling

#### holocron.jsonc
- Stored in `SiteBranch.docsJson` and `docsJsonComments`
- Comments preserved using custom JSONC parser
- Formatted with 2-space indentation

#### styles.css
- Stored in `SiteBranch.cssStyles`
- Can be null if not customized
- Returns empty string if not found

#### meta.json Files
- Stored in `MetaFile` table
- JSON data formatted with 2-space indentation
- Used for page metadata configuration

## Tool Integration

### strReplaceEditor Tool
```typescript
const strReplaceEditor = createEditTool({
    fileSystem,  // FileSystemEmulator instance
    async validateNewContent(x) {
        // Validation before writing
        if (mdxOrMdRegex.test(x.githubPath)) {
            // Parse and validate MDX
            await processMdxInServer({ markdown: x.content })
        }
        if (x.githubPath.endsWith('.json')) {
            // Validate JSON
            JSON.parse(x.content)
        }
    }
})
```

### Tool Usage Pattern
```typescript
// 1. Read current content
const currentContent = await fileSystem.read(filePath)

// 2. Modify content
const newContent = applyChanges(currentContent)

// 3. Write back
await fileSystem.write(filePath, newContent)

// 4. Changes automatically tracked in filesInDraft
```

## Change Notifications

### Notification Flow
```typescript
private async notifyChange(): Promise<void> {
    if (this.onFilesDraftChange) {
        await this.onFilesDraftChange()
    }
}
```

### Common Notification Handler
```typescript
onFilesDraftChange: async () => {
    // Update chat with current filesInDraft
    await prisma.chat.update({
        where: { chatId, userId },
        data: {
            filesInDraft: filesInDraft || {},
        },
    })
}
```

## Performance Optimizations

### Content Caching
```typescript
private originalContent = new Map<string, string>()
```
- Caches database content to avoid repeated queries
- Cache persists for emulator lifetime
- Cleared when emulator is recreated

### Batch Operations
- Single notification for multiple changes
- Reduces database update frequency
- Improves UI responsiveness

### Lazy Loading
- Content only fetched when needed
- Metadata operations don't load full content
- Line counting done incrementally

## Usage in AI Chat

### Initialization
```typescript
const fileSystem = new FileSystemEmulator({
    filesInDraft,
    getPageContent: async (githubPath) => {
        return await getPageContent({ githubPath, branchId })
    },
    onFilesDraftChange: async () => {
        // Save to database
        await prisma.chat.update({
            where: { chatId },
            data: { filesInDraft }
        })
    }
})
```

### Tool Access
```typescript
// Tools receive fileSystem instance
const tools = {
    strReplaceEditor: createEditTool({ fileSystem }),
    deletePages: tool({
        execute: async ({ filePaths }) => {
            await fileSystem.deleteBatch(filePaths)
        }
    }),
    renameFile: tool({
        execute: async ({ oldPath, newPath }) => {
            await fileSystem.move(oldPath, newPath)
        }
    })
}
```

## Error Handling

### File Not Found
```typescript
const content = await fileSystem.read('non-existent.md')
// Returns null, not error
```

### Invalid Operations
```typescript
try {
    await fileSystem.delete('non-existent.md')
} catch (error) {
    // Error: Cannot delete non-existent file
}
```

### Validation Errors
```typescript
try {
    await fileSystem.write('page.mdx', invalidMdx)
} catch (error) {
    // MDX compilation error with line numbers
}
```

## State Consistency

### Draft Priority
1. Always read from `filesInDraft` first
2. Database is fallback for non-draft files
3. Ensures preview shows latest changes

### Transaction Boundaries
- All changes stay in draft until explicit save
- Chat completion triggers database persistence
- Rollback possible by discarding draft

### Cross-Component Sync
- FileSystemEmulator notifies on changes
- State updates propagate to preview
- Database updates happen asynchronously