import { processMdxInServer } from 'docs-website/src/lib/mdx.server'
import fs from 'fs'

import path from 'path'
import { AssetForSync } from './sync'
import { mdxRegex } from './utils'

export async function* pagesFromDirectory(
    dirPath: string,
    base = '',
): AsyncGenerator<AssetForSync & { filePath: string; content: string }> {
    if (!base) {
        base = dirPath
    }
    console.log(`Processing directory: ${path.relative(base, dirPath)}`)
    const entries = await fs.promises.readdir(dirPath, {
        withFileTypes: true,
    })
    const totalPages = 0

    // Process files first
    for (const entry of entries.filter(
        (entry) => entry.isFile() && mdxRegex.test(entry.name),
    )) {
        const fullPath = path.join(dirPath, entry.name)
        const entryRelativePath = path.relative(base, fullPath)
        const entrySlug =
            '/' + entryRelativePath.replace(/\\/g, '/').replace(mdxRegex, '')

        const fileContent = await fs.promises.readFile(fullPath, 'utf8')

        const { data } = await processMdxInServer({
            markdown: fileContent,
            githubPath: entryRelativePath,
            extension: entry.name.split('.').pop() === 'mdx' ? 'mdx' : 'md',
        })
        const page = {
            totalPages,
            pageInput: {
                slug: entrySlug,
                title: data.title || '',
                markdown: fileContent,
                frontmatter: data.frontmatter,
                githubPath: entryRelativePath,
                githubSha: '',
                extension:
                    entry.name.split('.').pop() === 'mdx'
                        ? ('mdx' as const)
                        : ('md' as const),
                description: data.description || undefined,
                structuredData: data.structuredData as any,
            },
            type: 'page' as const,
            structuredData: data.structuredData,
        } satisfies AssetForSync
        if (page) {
            yield { ...page, content: fileContent, filePath: entryRelativePath }
        }
    }

    // Then process subdirectories
    for (const entry of entries.filter((entry) => entry.isDirectory())) {
        const fullPath = path.join(dirPath, entry.name)
        yield* pagesFromDirectory(fullPath, base)
    }
}
