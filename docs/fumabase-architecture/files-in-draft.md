---
title: filesInDraft Structure and Management
description: Deep dive into the filesInDraft data structure and how it manages in-memory file changes
prompt: |
  Document the filesInDraft structure from @website/src/lib/state.tsx and @docs-website/src/lib/edit-tool.
  Explain FileUpdate type with githubPath, content, addedLines, deletedLines fields. Show how it tracks
  file modifications in memory before database persistence. Reference how FileSystemEmulator uses it,
  how tools modify it, and how it's passed through the system. Include state management with Zustand.
---

# filesInDraft Structure and Management

The `filesInDraft` structure is the heart of Fumabase's real-time editing system. It maintains all file modifications in memory during an editing session, enabling instant preview updates without database writes.

## Data Structure

### FileUpdate Type
```typescript
type FileUpdate = {
    githubPath: string        // Full path to the file (e.g., "docs/getting-started.md")
    content: string | null    // File content (null indicates deletion)
    addedLines?: number       // Number of lines added (for tracking changes)
    deletedLines?: number     // Number of lines removed (for tracking changes)
}
```

### filesInDraft Record
```typescript
type FilesInDraft = Record<string, FileUpdate>
// Example:
{
    "docs/getting-started.md": {
        githubPath: "docs/getting-started.md",
        content: "# Getting Started\n\nWelcome to the docs...",
        addedLines: 5,
        deletedLines: 2
    },
    "docs/api.mdx": {
        githubPath: "docs/api.mdx",
        content: null,  // File marked for deletion
        deletedLines: 150
    }
}
```

## State Management

### Website State (Main App)
Located in `website/src/lib/state.tsx`:
```typescript
export type State = {
    currentSlug: string
    filesInDraft: Record<string, FileUpdate>
    lastPushedFiles: Record<string, FileUpdate>  // Track what was last synced
}
```

### Docs State (Preview Site)
Located in `docs-website/src/lib/docs-state.tsx`:
```typescript
export type DocsState = {
    filesInDraft: FilesInDraft
    deletedPages: Array<{ slug: string }>
    previewMode?: 'preview' | 'editor'
    // ... other fields
}
```

## File Operations

### Creating/Updating Files
When a file is created or modified:
1. Content is stored with full text
2. Line count changes are calculated
3. `addedLines` and `deletedLines` track the diff

### Deleting Files
When a file is deleted:
1. `content` is set to `null`
2. `deletedLines` contains the original line count
3. File remains in `filesInDraft` to track the deletion

### Moving/Renaming Files
When a file is moved:
1. New path entry is created with content
2. Old path entry is marked as deleted (`content: null`)
3. Both operations are tracked in `filesInDraft`

## Data Flow

### 1. Tool Modifications
AI tools (like `strReplaceEditor`) modify `filesInDraft`:
```typescript
// In edit-tool implementation
filesInDraft[path] = {
    githubPath: path,
    content: newContent,
    addedLines: calculateAddedLines(oldContent, newContent),
    deletedLines: calculateDeletedLines(oldContent, newContent)
}
```

### 2. FileSystemEmulator Access
FileSystemEmulator reads from `filesInDraft` first:
```typescript
async read(path: string): Promise<string | null> {
    // Check draft first
    if (this.filesInDraft[path]) {
        return this.filesInDraft[path].content
    }
    // Fall back to database
    return this.getOriginalContent(path)
}
```

### 3. Preview Updates
Docs website receives updates via postMessage:
```typescript
// When editor changes in docs-website
const message: IframeRpcMessage = {
    id: generateChatId(),
    state: {
        filesInDraft: {
            [githubPath]: updatedFile
        }
    }
}
window.parent.postMessage(message, '*')
```

## Change Detection

### Checking for Unpushed Changes
```typescript
export function doFilesInDraftNeedPush(
    currentFilesInDraft: Record<string, FileUpdate>,
    lastPushedFiles: Record<string, FileUpdate>
) {
    return Object.keys(currentFilesInDraft).some(key => {
        const current = currentFilesInDraft[key]
        const initial = lastPushedFiles[key]
        const currentContent = (current?.content ?? '').trim()
        const initialContent = (initial?.content ?? '').trim()
        return currentContent !== initialContent
    })
}
```

## Special Files Handling

### Configuration Files
- `fumabase.jsonc`: Website configuration
- `styles.css`: Custom CSS styles
- `meta.json`: Page metadata

These files are handled specially in `filesInDraft`:
1. Validated before storage
2. Parsed/serialized with proper formatting
3. May include comment preservation (for JSONC)

## Memory Management

### Limitations
- All changes stay in memory until chat completes
- Large files can consume significant memory
- No incremental saves during long sessions

### Optimizations
- Line count tracking avoids full diff calculations
- Null content for deletions saves memory
- Batch updates reduce state changes

## Persistence Strategy

### When filesInDraft Persists
1. **Chat Completion**: Saved to database with chat
2. **Manual Save**: User triggers sync
3. **GitHub Push**: Converted to Git commits

### When filesInDraft Clears
1. **New Chat**: Fresh session starts
2. **Discard Changes**: User cancels edits
3. **Successful Push**: After GitHub sync

## Best Practices

1. **Always Check Draft First**: Tools should read from `filesInDraft` before database
2. **Track All Changes**: Include line counts for better diff visualization
3. **Validate Content**: Check syntax before storing in draft
4. **Batch Updates**: Group related file changes to reduce renders
5. **Clean Up Nulls**: Remove deleted file entries after persistence