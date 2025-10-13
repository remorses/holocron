import frontMatter from 'front-matter'
import { VirtualFile } from 'fumadocs-core/source'
import { FilesInDraft } from './docs-state'
import { getFumadocsSource } from './source'
import { DocsJsonType } from './docs-json'

export interface GetTreeFromFilesParams {
  files: VirtualFile[]
  filesInDraft: FilesInDraft
  defaultLanguage: string
  languages: string[]
  githubFolder: string
  docsJson?: DocsJsonType
}

export const getTreeFromFiles = ({
  files,
  filesInDraft,
  defaultLanguage,
  languages,
  githubFolder,
  docsJson,
}: GetTreeFromFilesParams) => {
  function removeGithubFolder(p) {
    if (p.startsWith('/')) {
      p = p.slice(1)
    }
    if (p.startsWith(githubFolder)) {
      p = p.slice(githubFolder.length)
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
    const normalizedPath = removeGithubFolder(githubPath)
    const existingIndex = allFiles.findIndex((f) => f.path === normalizedPath)

    if (!fileData || fileData.content === null) {
      // Remove file if it exists and fileData is null or content is null (deleted)
      if (existingIndex >= 0) {
        allFiles.splice(existingIndex, 1)
      }
      return
    }

    // Determine file type based on extension
    const isMetaFile = githubPath.endsWith('meta.json')
    const isPageFile = githubPath.endsWith('.mdx') || githubPath.endsWith('.md')

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
        path: normalizedPath,
        type: 'meta',
      }
    } else {
      // Parse frontmatter for page files
      const { attributes: frontmatter } = frontMatter(fileData.content)

      draftFile = {
        data: frontmatter,
        path: normalizedPath,
        type: 'page',
      }
    }

    // Replace existing file or add new one
    // console.log(draftFile, allFiles)
    if (existingIndex >= 0) {
      allFiles[existingIndex] = draftFile
    } else {
      allFiles.push(draftFile)
    }
  })
  try {
    // Create source and get tree synchronously
    const source = getFumadocsSource({
      files: allFiles,
      defaultLanguage,
      languages,
      docsJson,
    })

    const tree = source.getPageTree(defaultLanguage || 'en')
    // force rerender
    tree.$id = Math.random().toString(36).slice(2)
    // console.log(tree)
    return { source, tree }
  } catch (e) {
    console.error(`cannot create tree with draft files`, e, filesInDraft)
    const source = getFumadocsSource({
      files,
      defaultLanguage,
      languages,
      docsJson,
    })

    const tree = source.getPageTree(defaultLanguage || 'en')
    tree.$id = Math.random().toString(36).slice(2)
    console.log(`creating new tree with id`, tree.$id)
    // console.log(tree)
    return { source, tree }
  }
}
