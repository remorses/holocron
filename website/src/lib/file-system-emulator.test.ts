import { describe, it, expect, vi } from 'vitest'
import { FileSystemEmulator } from './file-system-emulator'
import { FileUpdate } from 'docs-website/src/lib/edit-tool'

describe('FileSystemEmulator', () => {
  describe('move operations', () => {
    it('should delete old path after moving a file', async () => {
      const filesInDraft: Record<string, FileUpdate> = {}
      const mockGetPageContent = vi.fn().mockResolvedValue('original content')
      const mockOnChange = vi.fn()

      const fs = new FileSystemEmulator({
        filesInDraft,
        getPageContent: mockGetPageContent,
        onFilesDraftChange: mockOnChange,
      })

      // First write a file
      await fs.write('old/path.md', 'test content')

      // Move the file
      await fs.move('old/path.md', 'new/path.md')

      // Check that new path exists with correct content
      const newContent = await fs.read('new/path.md')
      expect(newContent).toBe('test content')

      // Check that old path is marked as deleted (returns null)
      const oldContent = await fs.read('old/path.md')
      expect(oldContent).toBeNull()

      // Check filesInDraft structure
      expect(filesInDraft['old/path.md']).toEqual({
        githubPath: 'old/path.md',
        content: null,
        deletedLines: 1,
      })

      expect(filesInDraft['new/path.md']).toEqual({
        githubPath: 'new/path.md',
        content: 'test content',
        addedLines: 1,
      })

      // Check that onChange was called
      expect(mockOnChange).toHaveBeenCalledTimes(2) // Once for write, once for move
    })

    it('should handle batch moves correctly', async () => {
      const filesInDraft: Record<string, FileUpdate> = {}
      const mockGetPageContent = vi.fn().mockResolvedValue('original content')
      const mockOnChange = vi.fn()

      const fs = new FileSystemEmulator({
        filesInDraft,
        getPageContent: mockGetPageContent,
        onFilesDraftChange: mockOnChange,
      })

      // Write multiple files
      await fs.writeBatch([
        { path: 'file1.md', content: 'content 1' },
        { path: 'file2.md', content: 'content 2\nline 2' },
        { path: 'file3.md', content: 'content 3\nline 2\nline 3' },
      ])

      // Move multiple files
      await fs.moveBatch([
        { oldPath: 'file1.md', newPath: 'moved/file1.md' },
        { oldPath: 'file2.md', newPath: 'moved/file2.md' },
        { oldPath: 'file3.md', newPath: 'moved/file3.md' },
      ])

      // Check that new paths exist
      expect(await fs.read('moved/file1.md')).toBe('content 1')
      expect(await fs.read('moved/file2.md')).toBe('content 2\nline 2')
      expect(await fs.read('moved/file3.md')).toBe('content 3\nline 2\nline 3')

      // Check that old paths are deleted
      expect(await fs.read('file1.md')).toBeNull()
      expect(await fs.read('file2.md')).toBeNull()
      expect(await fs.read('file3.md')).toBeNull()

      // Check filesInDraft for proper deletion markers
      expect(filesInDraft['file1.md'].content).toBeNull()
      expect(filesInDraft['file1.md'].deletedLines).toBe(1)

      expect(filesInDraft['file2.md'].content).toBeNull()
      expect(filesInDraft['file2.md'].deletedLines).toBe(2)

      expect(filesInDraft['file3.md'].content).toBeNull()
      expect(filesInDraft['file3.md'].deletedLines).toBe(3)
    })

    it('should not list deleted files in listFiles()', async () => {
      const filesInDraft: Record<string, FileUpdate> = {}
      const mockGetPageContent = vi.fn().mockResolvedValue(null)

      const fs = new FileSystemEmulator({
        filesInDraft,
        getPageContent: mockGetPageContent,
      })

      // Write some files
      await fs.writeBatch([
        { path: 'keep1.md', content: 'content 1' },
        { path: 'move-me.md', content: 'content to move' },
        { path: 'keep2.md', content: 'content 2' },
      ])

      // Move one file
      await fs.move('move-me.md', 'moved.md')

      // List files should not include the old path
      const files = await fs.listFiles()
      expect(files).toContain('keep1.md')
      expect(files).toContain('keep2.md')
      expect(files).toContain('moved.md')
      expect(files).not.toContain('move-me.md')
    })

    it('should throw error when trying to move non-existent file', async () => {
      const filesInDraft: Record<string, FileUpdate> = {}
      const mockGetPageContent = vi.fn().mockResolvedValue(null)

      const fs = new FileSystemEmulator({
        filesInDraft,
        getPageContent: mockGetPageContent,
      })

      await expect(fs.move('non-existent.md', 'new.md')).rejects.toThrow(
        'Cannot move non-existent file: non-existent.md',
      )
    })
  })
})
