import { createHash } from 'crypto'
import { lookup } from 'mime-types'
import { MarkdownExtension, MarkdownPage, Prisma, prisma } from 'db'
import { Sema } from 'async-sema'
import { request } from 'undici'
import { Readable } from 'node:stream'
import micromatch from 'micromatch'

import { DomainType } from 'db/src/generated/enums'
import { DocsJsonType } from 'docs-website/src/lib/docs-json'
import { DocsConfigSchema } from '@holocron.so/cli/src'
import { DocumentRecord, ProcessorData } from 'docs-website/src/lib/mdx-heavy'
import { StructuredData, Heading, StructuredContent } from 'docs-website/src/lib/remark-structure'
import { processMdxInServer } from 'docs-website/src/lib/mdx.server'
import { MdastToJsx } from 'safe-mdx'
import { mdxComponents } from 'docs-website/src/components/mdx-components'
import { getKeyForMediaAsset, getPresignedUrl, s3 } from 'docs-website/src/lib/s3'
import { deduplicateBy, generateSlugFromPath, isDocsJson } from 'docs-website/src/lib/utils'
import { DOCS_JSON_BASENAME } from 'docs-website/src/lib/constants'
import path from 'path'
import type { SearchApiFile } from 'searchapi/sdk'
import { CloudflareClient, getZoneIdForDomain } from './cloudflare'
import { env } from './env'
import { notifyError } from './errors'
import { getCacheTagForPage, getCacheTagForMediaAsset } from 'docs-website/src/lib/cache-tags'
import { addFrontSlashToPath, checkGitHubIsInstalled, getOctokit, getRepoFiles, isMarkdown } from './github.server'
import { mdxRegex, yieldTasksInParallel, processGeneratorConcurrentlyInOrder } from './utils'
import { imageDimensionsFromData } from 'image-dimensions'
import { applyJsonCComments, extractJsonCComments, JsonCComments } from './json-c-comments'
import { client as searchApi } from 'docs-website/src/lib/search-api'

export function gitBlobSha(content: string | Buffer, algo: 'sha1' | 'sha256' = 'sha1'): string {
  const body = Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf8')

  // Build the canonical Git header:  `blob <size>\0`
  const header = Buffer.from(`blob ${body.length}\0`, 'utf8')

  // Concatenate header + body and hash
  return createHash(algo)
    .update(Buffer.concat([header, body]))
    .digest('hex')
}

export type AssetForSync =
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
    /**
     * The file is uploaded first to S3 if the downloadUrl is not in the UPLOADS_BASE_URL url already, the docs website then expects the file to be in {UPLOADS_BASE_URL}/site/${siteId}/mediaAssets${slug}
     */
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

export const mediaExtensions = [
  // Image extensions
  'jpg',
  'jpeg',
  'png',
  'gif',
  'bmp',
  'webp',
  'svg',
  'ico',
  'tif',
  'tiff',
  'avif',
  // Video extensions
  'mp4',
  'mov',
  'avi',
  'wmv',
  'flv',
  'webm',
  'mkv',
  'm4v',
  '3gp',
  'ogg',
  'ogv',
].map((x) => '.' + x)

export function isMediaFile(path: string): boolean {
  if (!path) return false
  return mediaExtensions.some((ext) => path.toLowerCase().endsWith(ext))
}

export async function* assetsFromFilesList({
  files,
  githubFolder,
}: {
  files: {
    relativePath: string
    contents: string
    downloadUrl?: string
    metadata?: { width?: number; height?: number; bytes?: number }
  }[]
  githubFolder: string
}): AsyncGenerator<AssetForSync> {
  // Check if docs json exists in the files
  const holocronJsonFile = files.find((f) => isDocsJson(f.relativePath))

  // Only process docsJson if it exists in the files
  let docsJson: DocsJsonType | undefined
  let docsJsonComments: JsonCComments | undefined

  if (holocronJsonFile?.contents) {
    // Extract docsJson and comments from the docs json file
    const { comments, data } = extractJsonCComments(holocronJsonFile.contents)
    docsJson = data
    docsJsonComments = comments
  }
  // First handle meta.json files
  const metaFiles = files.filter((file) => file.relativePath.endsWith('meta.json'))
  for (const file of metaFiles) {
    yield {
      type: 'metaFile',
      content: file.contents,
      githubPath: file.relativePath,
      githubSha: gitBlobSha(file.contents),
      // filePath: file.relativePath,
    }
  }

  // Now yield docs json if provided
  if (docsJson !== undefined) {

    let content: string
    if (typeof docsJson === 'string') {
      content = docsJson
    } else {
      // Apply comments if provided
      if (docsJsonComments) {
        content = applyJsonCComments(docsJson, docsJsonComments, 2)
      } else {
        content = JSON.stringify(docsJson, null, 2)
      }
    }
    yield {
      type: 'docsJson',
      content,
      githubPath: path.posix.join(githubFolder, DOCS_JSON_BASENAME),
      githubSha: gitBlobSha(content),
      // filePath: path.posix.join(githubFolder, DOCS_JSON_BASENAME),
    }
  }

  // Handle styles.css
  const stylesCssFile = files.find(
    (file) => file.relativePath === 'styles.css' || file.relativePath.endsWith('/styles.css'),
  )
  if (stylesCssFile) {
    yield {
      type: 'stylesCss',
      content: stylesCssFile.contents,
      githubPath: stylesCssFile.relativePath,
      githubSha: gitBlobSha(stylesCssFile.contents),
      // filePath: stylesCssFile.relativePath,
    }
  }

  // Handle media assets
  const mediaFiles = files.filter((file) => isMediaFile(file.relativePath))
  for (const file of mediaFiles) {
    yield {
      type: 'mediaAsset' as const,
      githubSha: '',
      downloadUrl: file.downloadUrl || '', // Use provided downloadUrl or empty for local files
      githubPath: file.relativePath,
      width: file.metadata?.width,
      height: file.metadata?.height,
      bytes: file.metadata?.bytes,
      // filePath: file.relativePath,
      // content: file.contents,
    }
  }

  // Handle markdown/MDX files
  const markdownFiles = files.filter((file) => isMarkdown(file.relativePath))
  const totalPages = markdownFiles.length

  for (const file of markdownFiles) {
    yield {
      type: 'page',
      totalPages,
      markdown: file.contents,
      githubPath: file.relativePath,
      githubSha: gitBlobSha(file.contents),
      // filePath: file.relativePath,
      // content: file.contents,
    }
  }
}

export async function syncSite({
  branchId,
  siteId,
  files,
  signal,
  githubFolder,
  ignorePatterns = [],
}: {
  files: AsyncIterable<AssetForSync>
  branchId: string
  githubFolder: string
  siteId: string
  name: string
  signal?: AbortSignal
  ignorePatterns?: string[]
}): Promise<{ pageCount: number }> {
  const concurrencyLimit = 1 // TODO increase this to speed up sync
  const semaphore = new Sema(concurrencyLimit)
  let pageCount = 0

  // Helper function to check if a file should be ignored
  const shouldIgnoreFile = (githubPath: string): boolean => {
    if (ignorePatterns.length === 0) return false

    // Remove leading slash and githubFolder prefix for matching
    let pathForMatching = githubPath
    if (pathForMatching.startsWith('/')) {
      pathForMatching = pathForMatching.substring(1)
    }
    if (githubFolder && githubFolder !== '/' && githubFolder !== '') {
      const folderPrefix = githubFolder.startsWith('/') ? githubFolder.substring(1) : githubFolder
      if (pathForMatching.startsWith(folderPrefix + '/')) {
        pathForMatching = pathForMatching.substring(folderPrefix.length + 1)
      } else if (pathForMatching.startsWith(folderPrefix)) {
        pathForMatching = pathForMatching.substring(folderPrefix.length)
      }
    }
    if (pathForMatching.startsWith('/')) {
      pathForMatching = pathForMatching.substring(1)
    }

    return micromatch.isMatch(pathForMatching, ignorePatterns)
  }

  // Files to sync to search API
  let allFilesToSync: SearchApiFile[] = []
  let deletedFilenames: string[] = []
  const cacheTagsToInvalidate = [] as string[]
  const processedSlugs = new Set<string>()
  const deletedAssetPaths = [] as string[]

  // Get all media assets for this branch upfront
  let [allMediaAssets, branchDomains] = await Promise.all([
    prisma.mediaAsset.findMany({
      where: { branchId },
      select: { slug: true },
    }),
    prisma.domain.findMany({
      where: { branchId },
      select: { host: true, domainType: true },
    }),
  ])
  const mediaAssetSlugs = new Set(allMediaAssets.map((asset) => asset.slug))

  // Closure functions for each asset type
  async function syncMetaFile(asset: AssetForSync): Promise<SearchApiFile[]> {
    if (asset.type !== 'metaFile') return []

    let metaJsonData
    try {
      metaJsonData = JSON.parse(asset.content)
    } catch {
      metaJsonData = {}
    }
    await prisma.metaFile.upsert({
      where: {
        githubPath_branchId: {
          githubPath: asset.githubPath,
          branchId,
        },
      },
      update: {
        githubSha: asset.githubSha,
        githubPath: asset.githubPath,
        jsonData: metaJsonData,
        branchId,
      },
      create: {
        githubPath: asset.githubPath,
        jsonData: metaJsonData,
        branchId,
        githubSha: asset.githubSha,
      },
    })
    return []
  }

  async function syncDocsJson(asset: AssetForSync): Promise<SearchApiFile[]> {
    if (asset.type !== 'docsJson') return []

    const { data: jsonData, comments } = extractJsonCComments(asset.content)

    jsonData.siteId = siteId
    jsonData.name ??= ''

    const validationResult = DocsConfigSchema.safeParse(jsonData)
    if (!validationResult.success) {
      console.error(`Invalid holocron.jsonc schema:`, validationResult.error.format())
      notifyError(validationResult.error, `Invalid holocron.jsonc for site ${siteId}`)
      return []
    }



    await prisma.siteBranch.update({
      where: { branchId },
      data: { docsJson: jsonData, docsJsonComments: comments },
    })

    // Update site name if it's defined in docsJson
    if (jsonData.name) {
      await prisma.site.update({
        where: { siteId },
        data: { name: jsonData.name },
      })
      console.log(`Updated site name to: ${jsonData.name}`)
    }

    // Handle domain connections
    if (jsonData.domains && Array.isArray(jsonData.domains) && jsonData.domains.length > 0) {
      const existingHosts = new Set(branchDomains.map((d) => d.host))
      const configuredHosts = new Set(jsonData.domains)

      // TODO: Currently we only remove internalDomain types and leave customDomain/basepathDomain untouched.
      // This is just being cautious - we may want to remove customDomains in the future as well.
      // Remove internal domains that are no longer in the configuration
      // Note: basepathDomain types are never removed during sync
      const internalDomainsToRemove = branchDomains.filter(
        (domain) => domain.domainType === 'internalDomain' && !configuredHosts.has(domain.host),
      )

      if (internalDomainsToRemove.length > 0) {
        console.log(`Removing ${internalDomainsToRemove.length} internal domains that are no longer configured`)
        for (const domain of internalDomainsToRemove) {
          await prisma.domain.delete({
            where: {
              host: domain.host,
            },
          })
          console.log(`Removed internal domain: ${domain.host}`)
        }
        // Refresh branchDomains after deletion
        branchDomains = await prisma.domain.findMany({
          where: { branchId },
          select: { host: true, domainType: true },
        })
      }

      const domainsToConnect = jsonData.domains.filter((domain: string) => !existingHosts.has(domain) && domain.trim() !== '')

      if (domainsToConnect.length > 0) {
        console.log(`Connecting ${domainsToConnect.length} new domains for site ${siteId}`)
        for (const host of domainsToConnect) {
          if (!host || host.trim() === '') {
            console.log(`Skipping empty domain`)
            continue
          }
          const domainTaken = await prisma.domain.findFirst({
            where: { host },
          })
          if (domainTaken) {
            console.log(`Domain ${host} is already taken, skipping.`)
            continue
          }
          const domainType: DomainType =
            host.endsWith('.' + env.APPS_DOMAIN) || host.endsWith('.localhost') ? 'internalDomain' : 'customDomain'
          if (domainType === 'customDomain') {
            const zoneId = getZoneIdForDomain(host)
            const cloudflareClient = new CloudflareClient({
              zoneId,
            })
            const takenInCloudflare = await cloudflareClient.get(host).catch((e) => {
              notifyError(e, `Cloudflare domain check for ${host}`)
              return null
            })
            if (takenInCloudflare) console.log(takenInCloudflare)
            if (takenInCloudflare?.id) {
              console.log(`Domain ${host} is already taken in Cloudflare, skipping.`)
              continue
            }
          }
          try {
            const zoneId = getZoneIdForDomain(host)
            const cloudflareClient = new CloudflareClient({
              zoneId,
            })
            await cloudflareClient.createDomain({ domain: host })

            await prisma.domain.create({
              data: {
                host,
                branchId,
                domainType,
              },
            })
          } catch (e) {
            if (typeof e?.message === 'string' && e.message.includes('409 Conflict')) {
              console.log(`stopping addition of domain, 409 Conflict when creating domain ${host}: ${e.message}`)
            } else {
              throw e
            }
          }
        }
        // Refresh branchDomains after additions
        if (domainsToConnect.length > 0) {
          branchDomains = await prisma.domain.findMany({
            where: { branchId },
            select: { host: true, domainType: true },
          })
        }
      }
    }
    return []
  }

  async function syncStylesCss(asset: AssetForSync): Promise<SearchApiFile[]> {
    if (asset.type !== 'stylesCss') return []

    console.log(`Updating stylesCss for branch ${branchId}`)
    await prisma.siteBranch.update({
      where: { branchId },
      data: { cssStyles: asset.content },
    })
    return []
  }

  async function syncMediaAsset(asset: AssetForSync): Promise<SearchApiFile[]> {
    if (asset.type !== 'mediaAsset') return []

    let slug = getSlugFromPath({
      githubPath: asset.githubPath,
      githubFolder,
    })
    mediaAssetSlugs.add(slug)
    const downloadUrl = asset.downloadUrl

    let imageMetadata = {
      width: asset.width,
      height: asset.height,
      bytes: asset.bytes,
    }

    // Check if this is an image file based on extension
    const isImage = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.tif', '.tiff', '.avif'].some((ext) =>
      asset.githubPath.toLowerCase().endsWith(ext),
    )

    async function uploadAndGetMetadata() {
      if (!downloadUrl) return imageMetadata

      // Skip downloading/uploading if the downloadUrl is from our own uploads base URL
      if (downloadUrl && isValidUrl(downloadUrl) && downloadUrl.startsWith(env.UPLOADS_BASE_URL!)) {
        console.log(
          `Skipping upload for asset ${slug} as it is already hosted at UPLOADS_BASE_URL (${env.UPLOADS_BASE_URL})`,
        )
        return imageMetadata
      }

      const readable = await request(downloadUrl, { signal })

      const ok = readable.statusCode >= 200 && readable.statusCode < 300
      if (!ok) {
        throw new Error(`Failed to download asset ${readable.statusCode} ${slug}`)
      }
      if (!readable.body) {
        throw new Error(`Failed to get body for asset ${slug}`)
      }

      const key = getKeyForMediaAsset({ siteId, slug })

      // Download the full file
      const buffer = Buffer.from(await readable.body.arrayBuffer())
      imageMetadata.bytes = buffer.length

      // For images, extract dimensions
      if (isImage) {
        try {
          const dimensions = imageDimensionsFromData(buffer)
          if (dimensions) {
            imageMetadata.width = dimensions.width
            imageMetadata.height = dimensions.height
          }
        } catch (error) {
          // Continue without dimensions
        }
      }

      const contentType = lookup(asset.githubPath) || ''

      const signedUrl = await getPresignedUrl({
        method: 'PUT',
        key,
        headers: {
          'content-type': contentType,
          'Content-Length': buffer.length.toString(),
        },
      })
      const response = await fetch(signedUrl, {
        method: 'PUT',
        body: buffer,
        headers: {
          'Content-Type': contentType,
          'Content-Length': buffer.length.toString(),
        },
      })

      const cacheTag = getCacheTagForMediaAsset({
        branchId,
        slug,
      })
      cacheTagsToInvalidate.push(cacheTag)

      return imageMetadata
    }

    console.log(`uploading media asset ${asset.githubPath}`)

    // First download and get metadata
    const metadata = await uploadAndGetMetadata()

    // Then update database with the metadata
    await prisma.mediaAsset.upsert({
      where: {
        slug_branchId: {
          branchId,
          slug,
        },
      },
      update: {
        slug,
        branchId,
        width: metadata.width,
        height: metadata.height,
        bytes: metadata.bytes,
      },
      create: {
        githubSha: asset.githubSha,
        slug,
        githubPath: asset.githubPath,
        branchId,
        width: metadata.width,
        height: metadata.height,
        bytes: metadata.bytes || 0,
      },
    })
    return []
  }

  async function syncPage(asset: AssetForSync): Promise<SearchApiFile[]> {
    if (asset.type !== 'page') return []

    pageCount++ // Increment page count
    const filesToSyncForSearch: SearchApiFile[] = []
    const slug = getSlugFromPath({
      githubPath: asset.githubPath,
      githubFolder,
    })

    const extension = asset.githubPath.endsWith('.mdx') ? 'mdx' : 'md'

    if (processedSlugs.has(slug)) {
      console.log(`Skipping duplicate page with slug: ${slug}`)
      return filesToSyncForSearch
    }

    let data: ProcessorData
    let errors: Array<{
      errorMessage: string
      line: number
      errorType: 'mdxParse' | 'mdParse' | 'render'
    }> = []

    let markdown = asset.markdown
    let mdast = null as any
    const relativeImagesSlugs = [] as string[]
    try {
      const result = await processMdxInServer({
        markdown: asset.markdown,
        githubPath: asset.githubPath,
        extension: extension as MarkdownExtension,
      })
      data = result.data
      mdast = result.data.ast
      try {
        function registerRelativeImagePaths({ src }) {
          if (typeof src === 'string' && src.startsWith('/')) {
            // Convert relative path to slug (remove leading slash)
            const assetSlug = src
            // Only add if the media asset exists
            if (mediaAssetSlugs.has(assetSlug)) {
              relativeImagesSlugs.push(src)
            }
          }
        }
        const visitor = new MdastToJsx({
          markdown: asset.markdown,
          mdast: data.ast,
          components: {
            ...mdxComponents,
            img: registerRelativeImagePaths,
            Image: registerRelativeImagePaths,
          },
        })
        visitor.run()

        // Add safe-mdx errors as render errors
        if (visitor.errors && visitor.errors.length > 0) {
          for (const safeMdxError of visitor.errors) {
            errors.push({
              errorMessage: safeMdxError.message,
              line: safeMdxError.line || 1,
              errorType: 'render',
            })
          }
        }
      } catch (safeMdxError: any) {
        markdown = ''
        // If safe-mdx throws an error, add it as a render error
        errors.push({
          errorMessage: `rendering error: ${safeMdxError.message}`,
          line: 1,
          errorType: 'render',
        })
      }
    } catch (error: any) {
      markdown = ''
      const line = 'line' in error && typeof error.line === 'number' ? error.line : 1
      // Determine error type based on the extension
      const errorType = extension === 'mdx' ? 'mdxParse' : 'mdParse'
      errors.push({
        errorMessage: error.message,
        line,
        errorType,
      })
      console.error(`Failed to process ${asset.githubPath}:`, error.message)
      // Create placeholder data for failed processing
      data = {
        title: asset.githubPath,
        frontmatter: {},
        structuredData: { headings: [], contents: [] },
        ast: { type: 'root', children: [] },
        toc: [],
      }
    }

    const nonRecoverableErrors = errors.filter((e) => e.errorType === 'mdParse' || e.errorType === 'mdxParse')

    // When there are parse errors, set githubSha to null
    // This avoids creating unnecessary blob entries for error pages
    const effectiveGithubSha = nonRecoverableErrors.length > 0 ? null : asset.githubSha

    const pageInput: Prisma.MarkdownPageUncheckedCreateInput = {
      slug: slug,
      branchId,
      frontmatter: data.frontmatter,
      githubPath: asset.githubPath,
      githubSha: effectiveGithubSha,
    }

    const structuredData = data.structuredData

    // Create search API file for this page (skip if noindex or hidden)
    if (asset.markdown && data.frontmatter.visibility !== 'hidden' && data.frontmatter.noindex !== true) {
      filesToSyncForSearch.push({
        filename: asset.githubPath,
        content: asset.markdown,
        metadata: {
          title: data.frontmatter.title,
          slug: slug,
          frontmatter: data.frontmatter,
        },
        weight: 1.0,
      })
    }

    console.log(`Upserting page with slug: ${slug}, title: ${data.frontmatter.title}...`)

    errors = deduplicateBy(errors, (x) => String(x.line || 0))

    // Execute all operations in a single transaction array for data consistency
    // Create MarkdownBlob FIRST to satisfy foreign key constraint
    const transactionOps: Prisma.PrismaPromise<any>[] = []

    // First create/update MarkdownBlob if we have a valid githubSha
    if (effectiveGithubSha) {
      transactionOps.push(
        prisma.markdownBlob.upsert({
          where: { githubSha: effectiveGithubSha },
          update: {
            markdown,
            mdast,
            structuredData: data.structuredData as any,
          },
          create: {
            githubSha: effectiveGithubSha,
            markdown,
            mdast,
            structuredData: data.structuredData as any,
          },
        }),
      )
    }

    // Then create/update MarkdownPage (which references the blob)
    transactionOps.push(
      prisma.markdownPage.upsert({
        where: {
          branchId_slug: { branchId, slug: slug },
        },
        update: pageInput,
        create: { ...pageInput, branchId },
      }),
    )

    const results = await prisma.$transaction(transactionOps)
    // Get the page from the results (last item if blob was created, otherwise first)
    const page: MarkdownPage = effectiveGithubSha ? results[1] : results[0]

    // Now handle all relation operations in a single atomic transaction
    const relationOps: Prisma.PrismaPromise<any>[] = [
      // Delete existing relations first
      prisma.markdownPageSyncError.deleteMany({
        where: { pageId: page.pageId },
      }),
      prisma.pageMediaAsset.deleteMany({
        where: { pageId: page.pageId },
      }),
    ]

    // Add new sync errors if there were processing errors
    if (errors.length > 0) {
      relationOps.push(
        ...errors.map((error) =>
          prisma.markdownPageSyncError.create({
            data: {
              pageId: page.pageId,
              line: error.line,
              errorMessage: error.errorMessage,
              errorType: error.errorType,
            },
          }),
        ),
      )
    }

    // Add new PageMediaAsset records for relative image paths
    if (relativeImagesSlugs.length > 0) {
      relationOps.push(
        ...relativeImagesSlugs.map((imageSrc) =>
          prisma.pageMediaAsset.create({
            data: {
              pageId: page.pageId,
              assetSlug: imageSrc,
              branchId,
            },
          }),
        ),
      )
    }

    // Execute all relation operations atomically - this ensures delete and create are together
    await prisma.$transaction(relationOps)

    console.log(
      `Page upsert complete: ${page.pageId} (${page.githubPath})${errors.length > 0 ? ` with ${errors.length} error(s)` : ''}`,
    )
    processedSlugs.add(slug)

    // Add cache tag for invalidation
    const pageCacheTag = getCacheTagForPage({
      branchId,
      slug,
    })
    cacheTagsToInvalidate.push(pageCacheTag)

    console.log(` -> Upserted page: ${data.title} (ID: ${slug}, path: ${asset.githubPath})`)

    return filesToSyncForSearch
  }

  async function syncDeletedAsset(asset: AssetForSync): Promise<SearchApiFile[]> {
    if (asset.type !== 'deletedAsset') return []

    console.log(`Processing deleted asset: ${asset.githubPath}`)
    deletedAssetPaths.push(asset.githubPath)
    deletedFilenames.push(asset.githubPath)

    // Find and delete pages with this githubPath
    const pagesToDelete = await prisma.markdownPage.findMany({
      where: {
        branchId,
        githubPath: asset.githubPath,
      },
      select: {
        pageId: true,
        slug: true,
      },
    })

    if (pagesToDelete.length > 0) {
      console.log(`Found ${pagesToDelete.length} pages to delete for path ${asset.githubPath}`)

      // Add cache tags for invalidation
      for (const page of pagesToDelete) {
        const pageCacheTag = getCacheTagForPage({
          branchId,
          slug: page.slug,
        })
        cacheTagsToInvalidate.push(pageCacheTag)
      }

      // Deletion from search API will be handled after collecting all deleted files

      // Delete from database
      const deleteResult = await prisma.markdownPage.deleteMany({
        where: {
          branchId,
          githubPath: asset.githubPath,
        },
      })

      console.log(`Deleted ${deleteResult.count} pages from database for path ${asset.githubPath}`)
    }

    // Delete media assets with this githubPath
    const mediaDeleteResult = await prisma.mediaAsset.deleteMany({
      where: {
        branchId,
        githubPath: asset.githubPath,
      },
    })

    if (mediaDeleteResult.count > 0) {
      console.log(`Deleted ${mediaDeleteResult.count} media assets for path ${asset.githubPath}`)
    }

    // Delete meta files with this githubPath
    const metaDeleteResult = await prisma.metaFile.deleteMany({
      where: {
        branchId,
        githubPath: asset.githubPath,
      },
    })

    if (metaDeleteResult.count > 0) {
      console.log(`Deleted ${metaDeleteResult.count} meta files for path ${asset.githubPath}`)
    }

    return []
  }

  // Process all assets concurrently using processGeneratorConcurrentlyInOrder
  for await (const chunks of processGeneratorConcurrentlyInOrder(files, concurrencyLimit, async (asset) => {
    await semaphore.acquire()
    try {
      try {
        // Check if the file should be ignored (except for deletedAsset and docsJson)
        if (asset.type !== 'deletedAsset' && asset.type !== 'docsJson' && 'githubPath' in asset) {
          if (shouldIgnoreFile(asset.githubPath)) {
            console.log(`Ignoring file ${asset.githubPath} due to ignore patterns`)
            return []
          }
        }

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
          default:
            return []
        }
      } catch (e: any) {
        if (e.message.includes('lone leading surrogate in hex escape at line ')) {
          console.error(e)
          return []
        }
        throw e
      }
    } finally {
      semaphore.release()
    }
  })) {
    allFilesToSync.push(...chunks)
  }

  // Ensure dataset exists before syncing files
  console.log(`Ensuring dataset ${branchId} exists in search API...`)
  try {
    await searchApi.upsertDataset({
      datasetId: branchId, // Use branchId as dataset ID
    })
    console.log('Dataset created/updated successfully.')
  } catch (error) {
    console.error('Error creating/updating dataset in search API:', error)
    notifyError(error, 'search API dataset creation')
  }

  // Upload all files to search API
  if (allFilesToSync.length > 0) {
    console.log(`Syncing ${allFilesToSync.length} files to search API...`)
    try {
      await searchApi.upsertFiles({
        datasetId: branchId, // Use branchId as dataset ID
        files: allFilesToSync,
      })
      console.log('Files synced to search API successfully.')
    } catch (error) {
      console.error('Error syncing files to search API:', error)
      notifyError(error, 'search API sync')
    }
  } else {
    console.log('No files to sync to search API.')
  }

  // Delete files from search API
  if (deletedFilenames.length > 0) {
    console.log(`Deleting ${deletedFilenames.length} files from search API...`)
    try {
      await searchApi.deleteFiles({
        datasetId: branchId, // Use branchId as dataset ID
        filenames: deletedFilenames,
      })
      console.log('Files deleted from search API successfully.')
    } catch (error) {
      console.error('Error deleting files from search API:', error)
      notifyError(error, 'search API delete')
    }
  }

  // Invalidate cache tags
  if (cacheTagsToInvalidate.length) {
    // Group domains by their zone ID (using branchDomains from earlier)
    const zoneIdToDomains = new Map<string, string[]>()
    for (const domain of branchDomains) {
      const zoneId = getZoneIdForDomain(domain.host)
      if (!zoneIdToDomains.has(zoneId)) {
        zoneIdToDomains.set(zoneId, [])
      }
      zoneIdToDomains.get(zoneId)!.push(domain.host)
    }

    // Invalidate cache tags for each zone
    for (const [zoneId, domains] of zoneIdToDomains) {
      if (zoneId) {
        // Only invalidate if zone ID is not empty
        console.log(`Invalidating cache for zone ${zoneId} (domains: ${domains.join(', ')})`)
        const cloudflareClient = new CloudflareClient({ zoneId })
        try {
          await cloudflareClient.invalidateCacheTags(cacheTagsToInvalidate)
        } catch (error: any) {
          // Ignore 429 rate limit errors from Cloudflare
          if (error?.message && error.message.includes('429')) {
            console.log(`Ignoring 429 rate limit error for cache invalidation in zone ${zoneId}`)
          } else {
            throw error
          }
        }
      }
    }
  }

  // No cleanup needed for search API as it handles file updates automatically

  console.log('Import script finished.')
  return { pageCount }
}

function groupByN<T>(array: T[], n: number): T[][] {
  if (n <= 0) {
    throw new Error('Group size must be greater than 0')
  }

  // Return original array as single group if array length is smaller than n
  if (array.length <= n) {
    return [array]
  }

  const result: T[][] = []
  for (let i = 0; i < array.length; i += n) {
    result.push(array.slice(i, i + n))
  }
  return result
}

export function isMetaFile(path: string) {
  if (!path) return false
  return path.endsWith('/meta.json') || path === 'meta.json'
}

export function isDocsJsonFile(path: string): boolean {
  return isDocsJson(path)
}

export function isStylesCssFile(path: string): boolean {
  if (!path) return false
  return path === 'styles.css' || path.endsWith('/styles.css')
}

export async function* filesFromGithub({
  repo,
  owner,
  installationId,
  branchId,
  basePath = '',
  signal,
  onlyGithubPaths = new Set<string>(),
  forceFullSync = false,
  branch,
}: {
  repo: string
  owner: string
  installationId: number
  branchId: string
  basePath?: string
  signal?: AbortSignal
  onlyGithubPaths?: Set<string>
  forceFullSync?: boolean
  branch?: string
}) {
  if (basePath) {
    if (!basePath.startsWith('/')) {
      basePath = '/' + basePath
    }
  }
  if (!installationId) throw new Error('Installation ID is required')
  const octokit = await getOctokit({ installationId })
  const timeId = Date.now()

  const [repoResult, ok, existingPages, existingMediaAssets, existingMetaFiles] = await Promise.all([
    !branch &&
    octokit.rest.repos.get({
      owner,
      repo,
      request: { signal },
    }),
    checkGitHubIsInstalled({ installationId }),
    prisma.markdownPage.findMany({
      where: {
        branchId,
      },
      select: {
        githubSha: true,
        slug: true,
        githubPath: true,
      },
    }),
    prisma.mediaAsset.findMany({
      where: {
        branchId,
      },
    }),
    prisma.metaFile.findMany({
      where: {
        branchId,
      },
    }),
  ])

  if (!branch && repoResult) {
    branch = repoResult.data.default_branch
  }

  console.timeEnd(`${owner}/${repo} - repo checks ${timeId}`)

  if (!ok) {
    throw new Error('Github app no longer installed')
  }

  // Ensure branch is defined at this point
  if (!branch) {
    throw new Error('Branch name is required')
  }

  const existingPathsPlusSha = new Set<string>(
    existingPages
      .map((f) => f.githubPath + f.githubSha)
      .concat(
        existingMetaFiles.map((f) => f.githubPath + f.githubSha),
        existingMediaAssets.map((f) => f.githubPath + f.githubSha),
      ),
  )
  const existingSlugs = new Set(existingPages.map((f) => f.slug))
  let maxBlobFetches = 10_000
  let blobFetches = 0

  console.time(`${owner}/${repo} - fetch files ${timeId}`)
  let files = await getRepoFiles({
    fetchBlob(file) {
      let pathWithFrontSlash = addFrontSlashToPath(file.path || '')
      if (!file.sha) {
        console.log(`Skipping file ${file.path} because sha is missing`)
        return false
      }
      if (!(pathWithFrontSlash?.startsWith(basePath + '/') || pathWithFrontSlash === basePath)) {
        console.log(`Skipping file ${file.path} because path does not start with basePath (${basePath})`)
        return false
      }
      if (
        !isMarkdown(pathWithFrontSlash) &&
        !isMetaFile(pathWithFrontSlash) &&
        !isDocsJsonFile(pathWithFrontSlash) &&
        !isStylesCssFile(pathWithFrontSlash)
      ) {
        console.log(`Skipping file ${file.path} because it is not a markdown, meta, docs json, or styles.css file`)
        return false
      }
      if (forceFullSync) return true
      if (onlyGithubPaths.size && file.path) {
        return onlyGithubPaths.has(file.path)
      }
      if (file.sha && existingPathsPlusSha.has(file.path + file.sha)) {
        return false
      }

      blobFetches++
      return true
    },
    branch: branch,
    octokit: octokit.rest,
    owner,
    repo,
    signal,
  })
  if (basePath) {
    files = files.filter((x) => {
      return x.pathWithFrontSlash?.startsWith(basePath + '/')
    })
  }
  console.timeEnd(`${owner}/${repo} - fetch files ${timeId}`)

  // Find files that exist in database but not in GitHub (deleted files)
  const currentGithubPaths = new Set(files.map((f) => f.githubPath))

  // Check for deleted pages
  const deletedPages = existingPages.filter((page) => {
    return !currentGithubPaths.has(page.githubPath)
  })

  // Check for deleted media assets
  const deletedMediaAssets = existingMediaAssets.filter((asset) => {
    return !currentGithubPaths.has(asset.githubPath)
  })

  // Check for deleted meta files
  const deletedMetaFiles = existingMetaFiles.filter((meta) => {
    return !currentGithubPaths.has(meta.githubPath)
  })

  console.log(
    `Found ${deletedPages.length} deleted pages, ${deletedMediaAssets.length} deleted media assets, ${deletedMetaFiles.length} deleted meta files`,
  )
  // console.log(files)
  const mediaAssetsDownloads = yieldTasksInParallel(
    6,
    files
      .filter((x) => {
        return (
          x?.pathWithFrontSlash?.startsWith(basePath) &&
          mediaExtensions.some((ext) => {
            return x.githubPath.endsWith(ext)
          })
        )
      })
      .filter((x) => {
        if (forceFullSync) return true
        return !existingPathsPlusSha.has(x.githubPath + x.sha)
      })
      .map((x) => async () => {
        const slug = generateSlugFromPath(x.githubPath, basePath)

        const res = await octokit.rest.repos.getContent({
          owner,
          repo,
          path: x.githubPath,
          ref: branch,
          request: { signal },
        })
        if (!('download_url' in res.data)) {
          throw new Error('Could not get download url for image')
        }
        console.log('download url', res.data.download_url)
        const downloadUrl = res.data.download_url || ''
        const asset: AssetForSync = {
          type: 'mediaAsset',
          githubSha: x.sha,
          githubPath: x.githubPath,
          downloadUrl,
        }
        return asset
      }),
  )
  for await (let upload of mediaAssetsDownloads) {
    yield upload
  }
  const onlyMetaFiles = files
    .filter((x) => {
      if (x.content == null || !x?.pathWithFrontSlash?.startsWith(basePath) || !isMetaFile(x.pathWithFrontSlash)) {
        return false
      }
      return true
    })
    .filter((x) => {
      if (forceFullSync) return true
      return !existingPathsPlusSha.has(x.githubPath + x.sha)
    })

  for (let file of onlyMetaFiles) {
    const meta: AssetForSync = {
      type: 'metaFile',
      content: file.content || '{}',
      githubPath: file.githubPath,
      githubSha: file.sha,
    }
    yield meta
  }

  // Process docs json file (root only)
  const docsJsonFile = files.find((x) => {
    if (x.content == null || !x?.pathWithFrontSlash?.startsWith(basePath) || !isDocsJsonFile(x.pathWithFrontSlash)) {
      return false
    }
    if (forceFullSync) return true
    return !existingPathsPlusSha.has(x.githubPath + x.sha)
  })

  if (docsJsonFile) {
    const docsJson: AssetForSync = {
      type: 'docsJson',
      content: docsJsonFile.content || '{}',
      githubPath: docsJsonFile.githubPath,
      githubSha: docsJsonFile.sha,
    }
    yield docsJson
  }

  // Process styles.css file (root only)
  const stylesCssFile = files.find((x) => {
    if (x.content == null || !x?.pathWithFrontSlash?.startsWith(basePath) || !isStylesCssFile(x.pathWithFrontSlash)) {
      return false
    }
    if (forceFullSync) return true
    return !existingPathsPlusSha.has(x.githubPath + x.sha)
  })

  if (stylesCssFile) {
    const stylesCss: AssetForSync = {
      type: 'stylesCss',
      content: stylesCssFile.content || '',
      githubPath: stylesCssFile.githubPath,
      githubSha: stylesCssFile.sha,
    }
    yield stylesCss
  }

  let onlyMarkdown = files.filter((x) => {
    if (x.content == null) {
      console.log(`Skipping file ${x.githubPath} because content is null`)
      return false
    }
    if (!x?.pathWithFrontSlash?.startsWith(basePath)) {
      // console.log(
      //     `Skipping file ${x.githubPath} because path does not start with basePath (${basePath})`,
      // )
      return false
    }
    if (!isMarkdown(x.pathWithFrontSlash)) {
      console.log(`Skipping file ${x.githubPath} because it is not a markdown file`)
      return false
    }
    return true
  })

  console.log(
    `found ${onlyMarkdown.length} files to sync, from ${files.filter((x) => x?.pathWithFrontSlash?.startsWith(basePath) && isMarkdown(x?.pathWithFrontSlash)).length} total files`,
  )

  console.time(`${owner}/${repo} - process markdown ${timeId}`)
  const slugsFound = new Set<string>()
  let totalPages = onlyMarkdown.length
  let pagesToSync = onlyMarkdown
  if (onlyGithubPaths.size) {
    pagesToSync = onlyMarkdown.filter((x) => onlyGithubPaths.has(x.pathWithFrontSlash))
  }
  for (const x of pagesToSync) {
    if (x?.content == null) {
      continue
    }

    const pathWithFrontSlash = x.pathWithFrontSlash
    let content = x.content
    let extension: MarkdownExtension = path.extname(x.pathWithFrontSlash)?.endsWith('mdx') ? 'mdx' : 'md'
    const slug = generateSlugFromPath(pathWithFrontSlash, basePath)
    if (slugsFound.has(slug)) {
      console.log('duplicate slug found', slug, 'in', owner + '/' + repo, 'at', pathWithFrontSlash)
      continue
    }
    slugsFound.add(slug)

    yield {
      type: 'page',
      totalPages,
      markdown: content,
      githubPath: x.githubPath,
      githubSha: x.sha,
    } satisfies AssetForSync
  }

  // Yield deleted assets for cleanup
  for (const deletedPage of deletedPages) {
    yield {
      type: 'deletedAsset',
      githubPath: deletedPage.githubPath,
    } satisfies AssetForSync
  }

  for (const deletedMediaAsset of deletedMediaAssets) {
    yield {
      type: 'deletedAsset',
      githubPath: deletedMediaAsset.githubPath,
    } satisfies AssetForSync
  }

  for (const deletedMetaFile of deletedMetaFiles) {
    yield {
      type: 'deletedAsset',
      githubPath: deletedMetaFile.githubPath,
    } satisfies AssetForSync
  }
}

// export async function deletePages({
//     slugs,
//     siteId,
//     branchId,
// }: {
//     slugs: string[]
//     siteId: string
//     branchId: string
// }) {
//     console.log(
//         `Deleting pages with slugs: ${slugs.join(', ')} from branch ${branchId} in site ${siteId}`,
//     )

//     // Collect all githubPaths to delete from search API
//     const filesToDelete: string[] = []

//     // For each slug, find all pages that have that slug or start with that slug + "/"
//     for (const rootSlug of slugs) {
//         // Find the main page and all its children
//         console.log(`Finding pages for slug ${rootSlug} in branch ${branchId}`)
//         const pagesToDelete = await prisma.markdownPage.findMany({
//             where: {
//                 branchId,
//                 OR: [
//                     { slug: rootSlug },
//                     { slug: { startsWith: `${rootSlug}/` } },
//                 ],
//             },
//             select: {
//                 pageId: true,
//                 slug: true,
//                 githubPath: true,
//             },
//         })

//         if (pagesToDelete.length === 0) {
//             console.log(
//                 `No pages found for slug ${rootSlug} in branch ${branchId}`,
//             )
//             continue
//         }

//         console.log(
//             `Found ${pagesToDelete.length} pages to delete for slug ${rootSlug}`,
//         )

//         // Collect githubPaths for search API deletion
//         for (const page of pagesToDelete) {
//             filesToDelete.push(page.githubPath)
//         }

//         // Delete pages from database
//         console.log(`Deleting pages from database for slug ${rootSlug}`)
//         const deleteResult = await prisma.markdownPage.deleteMany({
//             where: {
//                 branchId,
//                 OR: [
//                     { slug: rootSlug },
//                     { slug: { startsWith: `${rootSlug}/` } },
//                 ],
//             },
//         })

//         console.log(
//             `Deleted ${deleteResult.count} pages from database for slug ${rootSlug}`,
//         )
//     }

//     // Delete files from search API
//     if (filesToDelete.length > 0) {
//         console.log(`Deleting ${filesToDelete.length} files from search API...`)
//         try {
//             await searchApi.deleteFiles({
//                 datasetId: branchId, // Use branchId as dataset ID
//                 filenames: filesToDelete,
//             })
//             console.log('Files deleted from search API successfully.')
//         } catch (error) {
//             console.error('Error deleting files from search API:', error)
//             notifyError(error, 'search API delete')
//         }
//     }

//     console.log('Page deletion completed')
// }

// processForTrieve function removed - now using search API SDK directly

// createTrieveDataset function removed - now using branchId as dataset ID in search API

export async function publicFileMapUrl({
  owner,
  repo,
  branch,
  imgPath,
}: {
  owner: string
  repo: string
  branch: string
  imgPath: string
}) {
  return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}${imgPath}`
}

function isValidUrl(string: string): boolean {
  return string.startsWith('http://') || string.startsWith('https://')
}

// TODO handle locales
function getSlugFromPath({ githubPath = '', githubFolder }) {
  if (githubPath.startsWith('/')) {
    githubPath = githubPath.substring(1)
  }
  if (githubFolder.startsWith('/')) {
    githubFolder = githubFolder.substring(1)
  }
  if (githubPath.startsWith(githubFolder)) {
    githubPath = githubPath.substring(githubFolder.length)
  }
  // replace again after base path removal
  if (githubPath.startsWith('/')) {
    githubPath = githubPath.substring(1)
  }

  githubPath = githubPath.replace(mdxRegex, '')
  return '/' + githubPath
}

/**
 * Utility function that waits until the given promise resolves, but does not block the event loop.
 * Returns the input promise, to allow for fire-and-forget async processing.
 * Useful for triggering background tasks without awaiting them directly.
 */
function waitUntil<T>(promise: Promise<T>): Promise<T> {
  // Swallow any unhandled rejections
  promise.catch((e) => {
    // Optionally log error, but don't interrupt execution
    notifyError(e, 'waitUntil error:')
  })
  return promise
}
