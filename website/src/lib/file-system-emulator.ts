import { FileUpdate } from 'docs-website/src/lib/edit-tool'

export interface FileSystemEmulatorOptions {
  filesInDraft: Record<string, FileUpdate>
  getPageContent: (githubPath: string) => Promise<string | undefined | void>
  onFilesDraftChange?: () => void | Promise<void>
  baseDir?: string
}

export class FileSystemEmulator {
  private filesInDraft: Record<string, FileUpdate>
  private getPageContent: (githubPath: string) => Promise<string | undefined | void>
  private onFilesDraftChange?: () => void | Promise<void>
  private originalContent = new Map<string, string>()
  private baseDir?: string

  constructor(options: FileSystemEmulatorOptions) {
    this.filesInDraft = options.filesInDraft
    this.getPageContent = options.getPageContent
    this.onFilesDraftChange = options.onFilesDraftChange
    this.baseDir = options.baseDir
  }

  private validatePath(path: string): void {
    if (this.baseDir) {
      if (!path.startsWith(this.baseDir)) {
        throw new Error(`Path should always start with baseDir: ${this.baseDir}`)
      }
    }
  }

  private async getOriginalContent(path: string): Promise<string | null> {
    if (this.originalContent.has(path)) {
      return this.originalContent.get(path)!
    }
    const content = await this.getPageContent(path)
    const contentStr = content || ''
    this.originalContent.set(path, contentStr)
    return contentStr || null
  }

  private async notifyChange(): Promise<void> {
    if (this.onFilesDraftChange) {
      await this.onFilesDraftChange()
    }
  }

  async read(path: string): Promise<string | null> {
    this.validatePath(path)
    // Check if file is in draft
    if (this.filesInDraft[path]) {
      return this.filesInDraft[path].content
    }
    // Otherwise get from original source
    return this.getOriginalContent(path)
  }

  async readBatch(paths: string[]): Promise<(string | null)[]> {
    return Promise.all(paths.map((path) => this.read(path)))
  }

  async exists(path: string): Promise<boolean> {
    const content = await this.read(path)
    return content !== null
  }

  async existsBatch(paths: string[]): Promise<boolean[]> {
    return Promise.all(paths.map((path) => this.exists(path)))
  }

  async write(path: string, content: string): Promise<void> {
    this.validatePath(path)
    const currentContent = await this.read(path)

    if (currentContent === null) {
      // New file
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

  async writeBatch(files: Array<{ path: string; content: string }>): Promise<void> {
    for (const { path } of files) {
      this.validatePath(path)
    }
    // Process all files without notifying
    for (const { path, content } of files) {
      const currentContent = await this.read(path)

      if (currentContent === null) {
        // New file
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
    }

    // Notify once at the end
    await this.notifyChange()
  }

  async delete(path: string): Promise<void> {
    this.validatePath(path)
    const content = await this.read(path)
    if (content === null) {
      throw new Error(`Cannot delete non-existent file: ${path}`)
    }

    const lineCount = content.split('\n').length
    this.filesInDraft[path] = {
      githubPath: path,
      content: null,
      deletedLines: lineCount,
    }

    await this.notifyChange()
  }

  async deleteBatch(paths: string[]): Promise<void> {
    for (const path of paths) {
      this.validatePath(path)
    }
    const contents = await this.readBatch(paths)
    for (let i = 0; i < paths.length; i++) {
      if (contents[i] === null) {
        throw new Error(`Cannot delete non-existent file: ${paths[i]}`)
      }
    }

    // Delete all files
    for (let i = 0; i < paths.length; i++) {
      const lineCount = contents[i]!.split('\n').length
      this.filesInDraft[paths[i]] = {
        githubPath: paths[i],
        content: null,
        deletedLines: lineCount,
      }
    }

    // Notify once at the end
    await this.notifyChange()
  }

  async move(oldPath: string, newPath: string): Promise<void> {
    this.validatePath(oldPath)
    this.validatePath(newPath)
    const content = await this.read(oldPath)
    if (content === null) {
      throw new Error(`Cannot move non-existent file: ${oldPath}`)
    }

    const lineCount = content.split('\n').length

    // Add new file
    this.filesInDraft[newPath] = {
      githubPath: newPath,
      content,
      addedLines: lineCount,
    }

    // Mark old file as deleted
    this.filesInDraft[oldPath] = {
      githubPath: oldPath,
      content: null,
      deletedLines: lineCount,
    }

    await this.notifyChange()
  }

  async moveBatch(moves: Array<{ oldPath: string; newPath: string }>): Promise<void> {
    // Validate all paths first
    for (const { oldPath, newPath } of moves) {
      this.validatePath(oldPath)
      this.validatePath(newPath)
    }
    // Validate all source files exist
    const oldPaths = moves.map((m) => m.oldPath)
    const contents = await this.readBatch(oldPaths)

    for (let i = 0; i < moves.length; i++) {
      if (contents[i] === null) {
        throw new Error(`Cannot move non-existent file: ${moves[i].oldPath}`)
      }
    }

    // Perform all moves
    for (let i = 0; i < moves.length; i++) {
      const content = contents[i]!
      const lineCount = content.split('\n').length
      const { oldPath, newPath } = moves[i]

      // Add new file
      this.filesInDraft[newPath] = {
        githubPath: newPath,
        content,
        addedLines: lineCount,
      }

      // Mark old file as deleted
      this.filesInDraft[oldPath] = {
        githubPath: oldPath,
        content: null,
        deletedLines: lineCount,
      }
    }

    // Notify once at the end
    await this.notifyChange()
  }

  async listFiles(): Promise<string[]> {
    // Get all paths from filesInDraft that aren't deleted
    const draftPaths = Object.keys(this.filesInDraft).filter((path) => this.filesInDraft[path].content !== null)

    // Also include original files that aren't in draft or aren't deleted
    const allPaths = new Set(draftPaths)

    // Note: We can't list original files without a separate API
    // This only returns files we know about from draft
    return Array.from(allPaths)
  }

  getFilesInDraft(): Record<string, FileUpdate> {
    return this.filesInDraft
  }
}
