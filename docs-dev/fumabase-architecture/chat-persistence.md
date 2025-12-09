---
title: Chat Persistence and Limitations
description: How chat sessions are persisted, the current limitations, and future improvements
prompt: |
  Document chat persistence from @website/src/lib/spiceflow-generate-message.tsx focusing on the onFinish
  handler that saves chat to database. Explain the limitation that filesInDraft is only updated when chat
  finishes, not during the session. Show how this creates the need to pass filesInDraft and holocron.jsonc
  content manually. Discuss the future improvement of debounced updates during chat. Include chat message
  storage with ChatMessage, ChatPartText, ChatPartTool tables.
---

# Chat Persistence and Limitations

The chat persistence system in Holocron has a critical limitation: `filesInDraft` is only saved to the database when a chat completes, not during the session. This creates challenges for state management and requires workarounds.

## Current Persistence Model

### Chat Completion Handler
From `spiceflow-generate-message.tsx`:
```typescript
onFinish: async ({ uiMessages, isAborted, model }) => {
    // Get previous messages for comparison
    const previousMessages = await prisma.chatMessage.findMany({
        where: { chatId },
        orderBy: { index: 'asc' },
    })
    
    // Get previous chat data
    const prevChat = await prisma.chat.findFirst({
        where: { chatId },
    })
    
    // Build transaction operations
    const operations: Prisma.PrismaPromise<any>[] = []
    
    // 1. Delete existing chat (cascade deletes messages)
    operations.push(
        prisma.chat.deleteMany({ where: { chatId } })
    )
    
    // 2. Recreate chat with updated filesInDraft
    operations.push(
        prisma.chat.create({
            data: {
                chatId,
                userId,
                branchId,
                currentSlug,
                filesInDraft: filesInDraft || {},  // SAVED HERE
                lastPushedFiles: prevChat?.lastPushedFiles || {},
                title: prevChat?.title,
                description: prevChat?.description,
                createdAt: prevChat?.createdAt,
                modelId: model.modelId,
                modelProvider: model.provider,
            },
        })
    )
    
    // 3. Save all messages and parts
    // ... message creation operations
    
    // Execute all at once
    await prisma.$transaction(operations)
}
```

## The Core Limitation

### Problem: No Intermediate Saves
```typescript
// During chat session:
// ❌ filesInDraft changes are NOT saved to database
// ❌ If browser crashes, all changes are lost
// ❌ Can't resume session with draft changes
// ❌ Other systems can't see current draft state

// Only at chat completion:
// ✅ filesInDraft finally saved to database
```

### Impact on System Design
This limitation forces manual passing of state:
```typescript
// Must pass filesInDraft explicitly to many functions:
const files = await getFilesForSource({
    branchId,
    filesInDraft,  // Manual pass
    githubFolder,
})

// Must pass holocron.jsonc content manually:
const holocronContent = filesInDraft['holocron.jsonc']?.content || 
                        await getPageContent({ githubPath: 'holocron.jsonc' })
```

## Current Workarounds

### 1. Manual State Passing
```typescript
// In generateMessageStream
export async function* generateMessageStream({
    messages,
    filesInDraft,  // Passed from client
    // ...
}) {
    // Create FileSystemEmulator with current filesInDraft
    const fileSystem = new FileSystemEmulator({
        filesInDraft,  // Use passed state
        getPageContent,
        onFilesDraftChange: async () => {
            // This only updates local state, not database
        }
    })
}
```

### 2. Client-Side State Management
```typescript
// Client maintains filesInDraft during session
const [filesInDraft, setFilesInDraft] = useState({})

// Send with each AI request
const response = await fetch('/generateMessage', {
    body: JSON.stringify({
        messages,
        filesInDraft,  // Include current state
    })
})
```

### 3. IFrame Synchronization
```typescript
// Docs-website sends updates via postMessage
window.parent.postMessage({
    state: { filesInDraft: updatedFiles }
}, '*')

// Website receives and holds in memory
handleMessage(event) {
    setState({ filesInDraft: event.data.state.filesInDraft })
}
```

## Message Storage Structure

### ChatMessage Table
```typescript
// Each message in the conversation
{
    id: string           // Unique message ID
    chatId: string       // Parent chat session
    role: string         // "user" or "assistant"
    index: number        // Order in conversation
    createdAt: DateTime
}
```

### Message Parts Storage
Different content types stored in separate tables:

#### ChatPartText
```typescript
{
    messageId: string
    type: "text"
    text: string         // Actual text content
    index: number        // Order within message
}
```

#### ChatPartTool
```typescript
{
    messageId: string
    type: string         // Tool name
    toolCallId: string   // Unique invocation ID
    state: string        // "output-available" | "output-error"
    input: Json          // Tool parameters
    output?: Json        // Tool result
    errorText?: string   // Error if failed
    index: number
}
```

#### ChatPartReasoning
```typescript
{
    messageId: string
    type: "reasoning"
    text: string         // AI reasoning text
    providerMetadata?: Json
    index: number
}
```

## Proposed Solution: Debounced Updates

### Concept
```typescript
// During chat session, periodically save filesInDraft
const debouncedSave = debounce(async (filesInDraft) => {
    await prisma.chat.update({
        where: { chatId },
        data: { filesInDraft }
    })
}, 5000)  // Save every 5 seconds of inactivity

// Trigger on each file change
onFilesDraftChange: () => {
    debouncedSave(filesInDraft)
}
```

### Implementation Challenges

#### 1. Update Sources
Multiple places can update filesInDraft:
- **Form Editor**: updateHolocronJsonc tool
- **Monaco Editor**: Direct text editing
- **AI Tools**: strReplaceEditor tool
- **File Operations**: Delete, rename tools

#### 2. Synchronization Points
```typescript
// Need to coordinate updates from:
// 1. Tool invocations in chat
fileSystem.write(path, content)  // Triggers update

// 2. Monaco editor in iframe
updateFileInDocsEditor(path, content)  // Sends postMessage

// 3. Form preview changes
updateHolocronJsonc({ values })  // Updates config
```

#### 3. Conflict Resolution
```typescript
// Handle concurrent updates
async function saveFilesInDraft(filesInDraft) {
    // Use optimistic locking
    const current = await prisma.chat.findUnique({
        where: { chatId },
        select: { version: true }
    })
    
    try {
        await prisma.chat.update({
            where: { 
                chatId,
                version: current.version  // Check version
            },
            data: {
                filesInDraft,
                version: { increment: 1 }
            }
        })
    } catch (error) {
        // Handle version conflict
        // Merge or retry
    }
}
```

## Session Recovery

### Current State (Limited)
```typescript
// Can only recover last completed chat
const chat = await prisma.chat.findUnique({
    where: { chatId },
    include: { messages: true }
})

// filesInDraft from last completion
const recoveredFiles = chat.filesInDraft
```

### With Debounced Updates (Improved)
```typescript
// Can recover in-progress session
const chat = await prisma.chat.findUnique({
    where: { chatId },
    include: { 
        messages: true,
        // filesInDraft is up-to-date (within debounce window)
    }
})

// Resume with recent draft changes
const filesInDraft = chat.filesInDraft || {}
```

## Performance Implications

### Current Model
- **Memory Usage**: All changes held in memory
- **Network**: Large payload on each message
- **Risk**: Total loss on crash

### With Periodic Saves
- **Memory**: Same (still need local state)
- **Network**: Additional update requests
- **Risk**: Maximum loss = debounce interval

## Future Improvements

### 1. Incremental Updates
```typescript
// Save only changed files
const changedFiles = getChangedFiles(filesInDraft, lastSaved)
await saveIncrementalChanges(chatId, changedFiles)
```

### 2. Operational Transform
```typescript
// Save operations instead of full content
const operations = [
    { type: 'insert', path: 'file.md', line: 10, text: 'new line' },
    { type: 'delete', path: 'file.md', lines: [15, 20] }
]
await saveOperations(chatId, operations)
```

### 3. WebSocket Updates
```typescript
// Real-time sync via WebSocket
ws.on('filesInDraftChange', (update) => {
    // Immediate database update
    await saveFilesInDraft(update)
    // Broadcast to other clients
    broadcast(chatId, update)
})
```

## Best Practices (Current System)

### 1. Minimize Risk
- Save important work frequently
- Use "Push to GitHub" for critical changes
- Keep chat sessions focused and short

### 2. State Management
- Always pass filesInDraft to functions that need it
- Check both filesInDraft and database for content
- Handle missing filesInDraft gracefully

### 3. Error Recovery
```typescript
try {
    // Attempt operation with filesInDraft
    const content = filesInDraft[path]?.content || 
                   await getPageContent({ path })
} catch (error) {
    // Fallback to database
    const content = await getPageContent({ path })
}
```

## Migration Path

### Phase 1: Add Debounced Saves
- Implement debounced update function
- Add to FileSystemEmulator.onFilesDraftChange
- Test with small subset of users

### Phase 2: Update All Touch Points
- Monaco editor integration
- Form editor integration  
- Tool invocation hooks

### Phase 3: Optimize
- Incremental updates
- Compression for large files
- Conflict resolution strategies

### Phase 4: Real-time Sync
- WebSocket infrastructure
- Multi-client coordination
- Collaborative editing support