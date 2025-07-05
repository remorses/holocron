import frontMatter from 'front-matter'
import { VirtualFile } from 'fumadocs-core/source'
import { getFumadocsClientSource } from './source'
import { FilesInDraft } from './docs-state'

export interface GetTreeFromFilesParams {
    files: VirtualFile[]
    filesInDraft: FilesInDraft
    i18n?: any
    githubFolder: string
}

export const getTreeFromFiles = ({
    files,
    filesInDraft,
    i18n,
    githubFolder,
}: GetTreeFromFilesParams) => {
    function removeGithubFolder(p) {
        if (p.startsWith('/')) {
            p = p.slice(1)
        }
        if (p.startsWith(githubFolder)) {
            p = p.slice(githubFolder.length + 1)
            if (p.startsWith('/')) {
                p = p.slice(1)
            }
            return p
        }
        return p
    }
    // Create files with filesInDraft included
    const allFiles: VirtualFile[] = [...files]

    // Add files from draft state
    Object.entries(filesInDraft).forEach(([githubPath, fileData]) => {
        if (!fileData) return

        // Determine file type based on extension
        const isMetaFile = githubPath.endsWith('meta.json')
        const isPageFile =
            githubPath.endsWith('.mdx') || githubPath.endsWith('.md')

        if (!isMetaFile && !isPageFile) return

        let draftFile: VirtualFile

        if (isMetaFile) {
            // Parse JSON for meta files
            let jsonData
            try {
                jsonData = JSON.parse(fileData.content)
            } catch {
                return // Skip invalid JSON
            }

            draftFile = {
                data: jsonData,
                path: removeGithubFolder(githubPath),
                type: 'meta',
            }
        } else {
            // Parse frontmatter for page files
            const { attributes: frontmatter } = frontMatter(fileData.content)

            draftFile = {
                data: frontmatter,
                path: removeGithubFolder(githubPath),
                type: 'page',
            }
        }

        // Replace existing file or add new one
        const existingIndex = allFiles.findIndex((f) => f.path === githubPath)
        if (existingIndex >= 0) {
            allFiles[existingIndex] = draftFile
        } else {
            allFiles.push(draftFile)
        }
    })
    try {
        // Create source and get tree synchronously
        const source = getFumadocsClientSource({
            files: allFiles,
            i18n,
        })

        const tree = source.getPageTree(i18n?.defaultLanguage || 'en')
        // force rerender
        tree.$id = Math.random().toString(36).slice(2)
        // console.log(tree)
        return tree
    } catch (e) {
        console.error(`cannot create tree with draft files`, e, filesInDraft)
        const source = getFumadocsClientSource({
            files,
            i18n,
        })

        const tree = source.getPageTree(i18n?.defaultLanguage || 'en')
        tree.$id = Math.random().toString(36).slice(2)
        console.log(`creating new tree with id`, tree.$id)
        // console.log(tree)
        return tree
    }
}
