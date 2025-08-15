import { prisma } from 'db'
import frontMatter from 'front-matter'

import { loader, MetaData, PageData, VirtualFile } from 'fumadocs-core/source'
import { getIconJsx } from './icons.server'
import { I18nConfig } from 'fumadocs-core/i18n'
import { ProcessorDataFrontmatter, StructuredData } from './mdx-heavy'
import { deduplicateBy, safeJsoncParse } from './utils'
import { FilesInDraft } from './docs-state'

type MyVirtualFile = VirtualFile & { data?: ProcessorDataFrontmatter }

export async function getFilesForSource({
    branchId,
    githubFolder,
    filesInDraft,
}: {
    branchId: string
    githubFolder: string
    filesInDraft: FilesInDraft
}): Promise<Array<MyVirtualFile>> {
    const [allPages, metaFiles] = await Promise.all([
        prisma.markdownPage.findMany({
            where: {
                branchId,
            },
        }),
        prisma.metaFile.findMany({
            where: {
                branchId,
            },
            omit: {},
        }),
    ])

    const files = allPages
        .map((x) => {
            let p = removeGithubFolder(x.githubPath, githubFolder)

            const res: MyVirtualFile = {
                data: { ...(x.frontmatter as any) },
                path: p,
                type: 'page',

                // slugs
            }
            return res
        })
        .concat(
            metaFiles.map((x) => {
                let githubPath = removeGithubFolder(x.githubPath, githubFolder)
                githubPath = removeFrontSlash(githubPath)
                const res: MyVirtualFile = {
                    data: x.jsonData as any,
                    path: githubPath,
                    type: 'meta',
                }
                return res
            }),
        )


    const draftFiles = getFilesFromFilesInDraft(filesInDraft, githubFolder)


    if (draftFiles.length > 0) {
        for (const draftFile of draftFiles) {

            const existingFileIndex = files.findIndex(
                (f) => f.path === draftFile.path,
            )

            if (existingFileIndex >= 0) {
                files[existingFileIndex] = draftFile
            } else {
                files.push(draftFile)
            }
        }

        // Remove deleted files
        for (const [githubPath, draft] of Object.entries(filesInDraft)) {
            if (draft?.content == null) {
                const normalizedPath = removeGithubFolder(
                    githubPath,
                    githubFolder,
                )
                const fileIndex = files.findIndex(
                    (f) => f.path === normalizedPath,
                )
                if (fileIndex >= 0) {
                    files.splice(fileIndex, 1)
                }
            }
        }
    }

    return deduplicateBy(files, (file) => file.path)
}

/**
 * Removes the leading slash from a given path, if present.
 * @param path - The input path string.
 * @returns The path without a leading slash.
 */
export function removeFrontSlash(path: string): string {
    if (path.startsWith('/')) {
        return path.slice(1)
    }
    return path
}
export function removeGithubFolder(path: string, githubFolder: string): string {
    if (githubFolder && path.startsWith(githubFolder)) {
        return removeFrontSlash(path.slice(githubFolder.length))
    }
    return removeFrontSlash(path)
}

/**
 * Convert filesInDraft to VirtualFile array for use with getFumadocsSource
 * Used in test utilities where we don't have database access
 */
export function getFilesFromFilesInDraft(
    filesInDraft: FilesInDraft,
    githubFolder: string = '',
): Array<MyVirtualFile> {
    const files: MyVirtualFile[] = []

    for (const [githubPath, draft] of Object.entries(filesInDraft)) {
        if (draft?.content == null) {
            // Skip deleted files
            continue
        }

        const normalizedPath = removeGithubFolder(githubPath, githubFolder)

        const isMetaFile = githubPath.endsWith('meta.json')

        const isPage = githubPath.endsWith('.md') || githubPath.endsWith('.mdx')

        if (isPage) {
            let data: ProcessorDataFrontmatter = {}
            try {
                data =
                    frontMatter<ProcessorDataFrontmatter>(draft.content || '')
                        .attributes || {}
            } catch {}
            files.push({
                path: normalizedPath,
                data,
                type: 'page',
            })
        }
        if (isMetaFile) {
            files.push({
                path: normalizedPath,
                data: safeJsoncParse(draft.content) || {},
                type: 'meta',
            })
        }
    }

    return files
}
