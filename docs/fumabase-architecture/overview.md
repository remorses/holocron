---
title: Fumabase Editing Architecture Overview
description: High-level overview of how Fumabase manages file editing, state management, and database synchronization
prompt: |
  Generate documentation about how Fumabase's filesInDraft and database schema for pages, media assets
  and meta json files works. Document the two-way flow: files to database handled by @website/src/lib/sync.ts
  and database to file content handled by getPageContent function passed to FileSystemEmulator in
  @website/src/lib/file-system-emulator.ts. Reference @website/src/lib/spiceflow-generate-message.tsx
  for tools integration, @website/src/lib/state.tsx and @docs-website/src/lib/docs-state.tsx for
  state management. Explain the in-memory filesInDraft structure, database persistence, and iframe
  postMessage synchronization. Create comprehensive architecture documentation with multiple markdown files.
---

# Fumabase Editing Architecture Overview

Fumabase uses a sophisticated two-way data flow architecture to manage documentation websites. This system allows real-time editing through an AI chat interface while maintaining consistency between in-memory drafts, database storage, and live preview rendering.

## Core Components

### 1. **filesInDraft** - In-Memory Draft State
The central data structure that holds all file modifications during an editing session. Files remain in draft until explicitly synced to the database.

### 2. **Database Schema**
Persistent storage for pages, media assets, meta files, and configuration using Prisma ORM with PostgreSQL.

### 3. **Two-Way Sync Flow**
- **Files → Database**: Handled by `sync.ts` for importing and syncing content
- **Database → Files**: Handled by `getPageContent` function for reading content

### 4. **FileSystemEmulator**
Virtual file system that provides a unified interface for reading/writing files, abstracting away the difference between draft and persisted content.

### 5. **State Management**
- **Website State**: Main editing state using Zustand
- **Docs State**: Preview website state, synchronized via iframe postMessage

## Key Flows

### Editing Flow
1. User interacts with AI chat to request changes
2. AI uses tools (strReplaceEditor) to modify files
3. Changes are stored in `filesInDraft` (in-memory)
4. Preview updates immediately showing draft changes
5. Database is updated when chat completes

### Preview Flow
1. Docs website reads from both database and `filesInDraft`
2. FileSystemEmulator provides unified access
3. Monaco editor and markdown preview show live updates
4. Changes sync back to parent via postMessage

### Persistence Flow
1. Chat messages and `filesInDraft` are saved to database when chat ends
2. GitHub sync can push changes to repository
3. Search API indexes content for full-text search

## Architecture Advantages

- **Real-time Preview**: Changes appear instantly without database writes
- **Atomic Sessions**: All changes in a chat are grouped together
- **Rollback Capability**: Draft changes can be discarded
- **Collaborative Editing**: Multiple tools can modify files concurrently
- **Version Control Ready**: Changes can be pushed to GitHub as commits

## Key Challenges

- **State Synchronization**: Keeping website and docs-website in sync
- **Debounced Updates**: Database updates only happen at chat completion
- **Complex State Passing**: filesInDraft must be passed through multiple layers
- **Tool Coordination**: Multiple AI tools need consistent file access

## Next Steps

See the detailed documentation for each component:
- [filesInDraft Structure](./files-in-draft.md)
- [Database Schema](./database-schema.md)
- [Sync Flow](./sync-flow.md)
- [File System Emulator](./file-system-emulator.md)
- [State Management](./state-management.md)
- [Chat Persistence](./chat-persistence.md)