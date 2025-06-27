import { cac } from 'cac'
import os from 'os'
import { DocsJsonType } from 'docs-website/src/lib/docs-json'

import fs from 'fs'
import path from 'path'

import { globby } from 'globby'
import { createApiClient } from './generated/spiceflow-client.js'
import { execSync } from 'child_process'
import { readTopLevelDocsJson, getCurrentGitBranch, openUrlInBrowser } from './utils.js'

export const cli = cac('fumabase')

cli.help()

type FilesInDraft = Record<
    string,
    {
        content: string
        githubPath: string
    }
>

const url = process.env.SERVER_URL || 'https://fumabase.com'

const apiClient = createApiClient(url)


cli.command('dev', 'Preview your fumabase website').action(
    async function main(options) {
        // console.log({ options })
        const {} = options
        const dir = process.cwd()
        try {
            const filePaths = await globby(
                ['**/*.md', '**/*.mdx', '**/meta.json', '**/docs.json'],
                {
                    cwd: dir,
                    onlyFiles: true,
                },
            )
            if (!filePaths.length) {
                console.error(`No files to upload inside ${dir}`)
                return
            }
            const docsJson = await readTopLevelDocsJson()
            if (!docsJson) {
                console.error(
                    'docs.json file not found at the project root. Use fumabase init to create a new project',
                )
            }
            const filesInDraft: FilesInDraft = Object.fromEntries(
                await Promise.all(
                    filePaths.map(async (filePath) => {
                        const fullPath = path.resolve(dir, filePath)
                        const content = await fs.promises.readFile(
                            fullPath,
                            'utf-8',
                        )
                        // You may want to replace this with your githubPath logic
                        const githubPath = filePath
                        return [
                            filePath,
                            {
                                content,
                                githubPath,
                            },
                        ]
                    }),
                ),
            )
            const siteId = docsJson.siteId
            if (!siteId) {
                console.error('siteId not found in docs.json')
                return
            }
            const githubBranch = getCurrentGitBranch()
            const { data, error } =
                await apiClient.api.getPreviewUrlForSiteId.post({
                    githubBranch,
                    siteId,
                })
            const previewUrl = data.previewUrl
            openUrlInBrowser(previewUrl)

            if (error) {
                console.error(`cannot get the preview url for this site`)
                return
            }
        } catch (error) {
            console.error(error)

            throw error
        }
    },
)
