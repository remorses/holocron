import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { SearchClient } from './sdk.js'
import * as lancedb from '@lancedb/lancedb'

describe('getExistingFiles', () => {
  let client: SearchClient
  let datasetId: string
  let table: lancedb.Table | null

  beforeEach(async () => {
    client = new SearchClient('./test-existing-files-db')
    datasetId = 'test-existing-files'

    // Create dataset and add some test files
    await client.upsertDataset({ datasetId })
    await client.upsertFiles({
      datasetId,
      files: [
        { filename: 'file1.md', content: '# File 1 Content' },
        { filename: 'file2.md', content: '# File 2 Content' },
        {
          filename: "file-with-quote'.md",
          content: '# File with quote',
        },
        {
          filename: 'special/path/file.md',
          content: '# Special path file',
        },
      ],
    })

    // Get the table for testing
    const tableName = datasetId.replace(/[^a-zA-Z0-9_]/g, '_')
    const db = await (client as any).getConnection()
    table = await db.openTable(tableName)
  })

  afterEach(async () => {
    await client.deleteDataset({ datasetId })
  })

  it('should return empty map for empty filenames array', async () => {
    const result = await client.getExistingFiles(table!, [])
    expect(result.size).toBe(0)
  })

  it('should find existing files with correct SHA', async () => {
    const result = await client.getExistingFiles(table!, [
      'file1.md',
      'file2.md',
    ])

    expect(result.size).toBe(2)
    expect(result.has('file1.md')).toBe(true)
    expect(result.has('file2.md')).toBe(true)

    // Check that SHAs are returned (non-empty strings)
    expect(result.get('file1.md')).toBeTruthy()
    expect(result.get('file2.md')).toBeTruthy()
    expect(typeof result.get('file1.md')).toBe('string')
    expect(typeof result.get('file2.md')).toBe('string')
  })

  it('should handle filenames with special characters', async () => {
    const result = await client.getExistingFiles(table!, [
      "file-with-quote'.md",
    ])

    expect(result.size).toBe(1)
    expect(result.has("file-with-quote'.md")).toBe(true)
  })

  it('should handle filenames with paths', async () => {
    const result = await client.getExistingFiles(table!, [
      'special/path/file.md',
    ])

    expect(result.size).toBe(1)
    expect(result.has('special/path/file.md')).toBe(true)
  })

  it('should return empty map for non-existent files', async () => {
    const result = await client.getExistingFiles(table!, [
      'non-existent-file.md',
      'another-missing.md',
    ])

    expect(result.size).toBe(0)
  })

  it('should handle mix of existing and non-existent files', async () => {
    const result = await client.getExistingFiles(table!, [
      'file1.md',
      'non-existent.md',
      'file2.md',
      'missing.md',
    ])

    expect(result.size).toBe(2)
    expect(result.has('file1.md')).toBe(true)
    expect(result.has('file2.md')).toBe(true)
    expect(result.has('non-existent.md')).toBe(false)
    expect(result.has('missing.md')).toBe(false)
  })

  it('should handle large number of filenames', async () => {
    // Create many files
    const manyFiles = Array.from({ length: 100 }, (_, i) => ({
      filename: `file-${i}.md`,
      content: `# File ${i}`,
    }))

    await client.upsertFiles({
      datasetId,
      files: manyFiles,
    })

    // Get fresh table reference after adding many files
    const tableName = datasetId.replace(/[^a-zA-Z0-9_]/g, '_')
    const db = await (client as any).getConnection()
    const freshTable = await db.openTable(tableName)

    // Query for all of them
    const filenames = manyFiles.map((f) => f.filename)
    const result = await client.getExistingFiles(freshTable, filenames)

    expect(result.size).toBe(100)

    // Check a few random ones
    expect(result.has('file-0.md')).toBe(true)
    expect(result.has('file-50.md')).toBe(true)
    expect(result.has('file-99.md')).toBe(true)
  })

  it('should only return files (not sections)', async () => {
    // The upsertFiles method creates both file and section rows
    // This test ensures we only get file rows back
    const result = await client.getExistingFiles(table!, ['file1.md'])

    expect(result.size).toBe(1)
    expect(result.has('file1.md')).toBe(true)

    // Verify the SHA matches what we expect for a file row
    const sha = result.get('file1.md')
    expect(sha).toBeTruthy()
    expect(sha!.length).toBeGreaterThan(0)
  })

  it('should handle SQL injection attempts', async () => {
    // Test with filenames that could be SQL injection attempts
    const maliciousFilenames = [
      "'; DROP TABLE test; --",
      "file.md' OR 1=1 --",
      "file.md'); DELETE FROM test WHERE 1=1; --",
    ]

    // Should not throw and should return empty map (files don't exist)
    const result = await client.getExistingFiles(table!, maliciousFilenames)
    expect(result.size).toBe(0)
  })

  it('should correctly support deduplication during upsert', async () => {
    // First upload
    await client.upsertFiles({
      datasetId: 'test-dedup-upsert',
      files: [
        { filename: 'dedup1.md', content: '# Original content' },
        { filename: 'dedup2.md', content: '# Another file' },
      ],
    })

    // Get table
    const tableName = 'test-dedup-upsert'.replace(/[^a-zA-Z0-9_]/g, '_')
    const db = await (client as any).getConnection()
    const dedupTable = await db.openTable(tableName)

    // Verify files exist
    const existing = await client.getExistingFiles(dedupTable, [
      'dedup1.md',
      'dedup2.md',
    ])
    expect(existing.size).toBe(2)

    const originalSha1 = existing.get('dedup1.md')
    const originalSha2 = existing.get('dedup2.md')

    // Second upload with same content - should be skipped
    await client.upsertFiles({
      datasetId: 'test-dedup-upsert',
      files: [
        { filename: 'dedup1.md', content: '# Original content' },
        { filename: 'dedup2.md', content: '# Another file' },
      ],
    })

    // Third upload with one file changed
    await client.upsertFiles({
      datasetId: 'test-dedup-upsert',
      files: [
        { filename: 'dedup1.md', content: '# Changed content!' }, // Changed
        { filename: 'dedup2.md', content: '# Another file' }, // Same
      ],
    })

    // Get fresh table reference and verify SHAs
    const freshDedupTable = await db.openTable(tableName)
    const finalFiles = await client.getExistingFiles(freshDedupTable, [
      'dedup1.md',
      'dedup2.md',
    ])
    expect(finalFiles.size).toBe(2)

    const finalSha1 = finalFiles.get('dedup1.md')
    const finalSha2 = finalFiles.get('dedup2.md')

    // dedup1.md should have changed
    expect(finalSha1).not.toBe(originalSha1)
    // dedup2.md should be the same
    expect(finalSha2).toBe(originalSha2)

    // Cleanup
    await client.deleteDataset({ datasetId: 'test-dedup-upsert' })
  })
})
