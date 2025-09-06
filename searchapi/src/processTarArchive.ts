import { parseTar } from '@xmorse/tar-parser'
import { z } from 'zod'
import { DatasetsInterface, FileSchema } from './types.js'

const SUPPORTED_EXTENSIONS = ['.md', '.mdx'] as const

export async function processTarArchive({
  url,
  datasetId,
  path,
  metadata,

  stub,
}: {
  url: string
  datasetId: string
  path?: string
  metadata?: any

  stub: DatasetsInterface
}): Promise<{ filesImported: number; totalSizeBytes: number }> {
  const startTime = Date.now()
  let filesImported = 0
  let totalSizeBytes = 0

  // Fetch the tar archive
  const response = await fetch(url)
  if (!response.ok) {
    const errorBody = await response.text().catch(() => 'No error body')
    throw new Error(
      `Tar archive fetch failed (${response.status} ${response.statusText}). URL: ${url}. Error: ${errorBody}`,
    )
  }

  // Check content type
  const contentType = response.headers.get('content-type')
  if (
    contentType &&
    !contentType.includes('gzip') &&
    !contentType.includes('tar') &&
    !contentType.includes('octet-stream')
  ) {
    throw new Error(`Invalid content type: ${contentType}. Expected tar.gz archive. URL: ${url}`)
  }

  console.log(`[import-tar] Fetching tar archive from ${url}`)

  if (!response.body) {
    throw new Error('Response body is null')
  }

  // Decompress the gzipped tar
  const gz = response.body.pipeThrough(new DecompressionStream('gzip'))

  // Collect all valid tar entries first
  const allEntries: Array<{ relativePath: string; buffer: ArrayBuffer }> = []
  let entriesProcessed = 0

  // Parse the tar and collect files
  await parseTar(gz, async (entry) => {
    entriesProcessed++
    if (entriesProcessed % 1000 === 0) {
      console.log(`[import-tar] Processed ${entriesProcessed} tar entries...`)
    }

    if (entry.header.type !== 'file') return

    // Extract relative path (remove first directory component which is the repo name)
    const relativePath = entry.name.split('/').slice(1).join('/')

    // Skip if path filter is specified and doesn't match
    if (path && !relativePath.startsWith(path)) return

    // Check if file has supported extension
    const hasSuportedExtension = SUPPORTED_EXTENSIONS.some((ext) => relativePath.endsWith(ext))
    if (!hasSuportedExtension) return

    // Read the file content
    const buffer = await entry.arrayBuffer()

    // Only store files under 1MB
    if (buffer.byteLength >= 1_000_000) {
      console.log(
        `[import-tar] Skipping large file (${(buffer.byteLength / 1024 / 1024).toFixed(2)}MB): ${relativePath}`,
      )
      return
    }

    allEntries.push({ relativePath, buffer })
  })

  console.log(`[import-tar] Collected ${allEntries.length} files from tar archive`)

  // Process files in batches
  // LanceDB recommends 10k-100k rows per batch for optimal performance
  const BATCH_SIZE = 1000 // Increased from 50 for better cloud performance

  for (let i = 0; i < allEntries.length; i += BATCH_SIZE) {
    const batchEntries = allEntries.slice(i, i + BATCH_SIZE)
    const batch: z.infer<typeof FileSchema>[] = []

    // Convert entries to files
    for (const { relativePath, buffer } of batchEntries) {
      try {
        const content = new TextDecoder('utf-8', {
          fatal: true,
          ignoreBOM: false,
        }).decode(buffer)

        // Remove path prefix if specified
        const filename =
          path && relativePath.startsWith(path) ? relativePath.slice(path.length).replace(/^\//, '') : relativePath

        batch.push({
          filename,
          content,
          metadata: {
            ...metadata,
            importedAt: new Date().toISOString(),
            originalPath: relativePath,
          },
          weight: 1.0,
        })

        totalSizeBytes += buffer.byteLength
      } catch (error) {
        // Skip files that can't be decoded as UTF-8
        console.warn(`[import-tar] Skipping file ${relativePath}: ${error.message}`)
      }
    }

    // Upload this batch
    if (batch.length > 0) {
      const batchNumber = Math.floor(i / BATCH_SIZE) + 1
      console.log(`[import-tar] Uploading batch ${batchNumber} (${batch.length} files)...`)

      const batchStartTime = Date.now()
      await stub.upsertFiles({
        datasetId,
        files: batch,
      })

      filesImported += batch.length
      const batchDuration = (Date.now() - batchStartTime) / 1000
      console.log(
        `[import-tar] Batch ${batchNumber} completed in ${batchDuration.toFixed(2)}s (total: ${filesImported} files)`,
      )
    }
  }

  const duration = (Date.now() - startTime) / 1000
  console.log(
    `[import-tar] Successfully imported ${filesImported} files (${(totalSizeBytes / 1024 / 1024).toFixed(2)} MB) in ${duration.toFixed(2)} seconds`,
  )

  // After bulk import, create indexes and optimize if using SearchClient
  const { SearchClient } = await import('./sdk.js')
  if (stub instanceof SearchClient) {
    console.log('[import-tar] Creating indexes after bulk import...')
    await stub.createPendingIndexes(datasetId)

    // Optimize table if many files were imported
    if (filesImported > 5000) {
      console.log('[import-tar] Optimizing table after large import...')
      await stub.optimizeTable(datasetId)
    }
  }

  return { filesImported, totalSizeBytes }
}
