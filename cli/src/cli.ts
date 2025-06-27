import { cac } from 'cac'
import os from 'os'

import fs from 'fs'
import path from 'path'

import { globby } from 'globby'
import { createApiClient } from './generated/spiceflow-client.js'
import { execSync } from 'child_process'
import {
    readTopLevelDocsJson,
    getCurrentGitBranch,
    openUrlInBrowser,
} from './utils.js'
import { startWebSocketWithTunnel } from './server.js'

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

cli.command('init', 'Initialize a new fumabase project').action(() => {
    openUrlInBrowser('https://fumabase.com/login')
})

cli.command('dev', 'Preview your fumabase website').action(
    async function main(options) {
        // console.log({ options })
        const {} = options
        const dir = process.cwd()
        try {
            const globs = [
                '**/*.md',
                '**/*.mdx',
                '**/meta.json',
                '**/docs.json',
            ]
            const filePaths = await globby(globs, {
                cwd: dir,
                onlyFiles: true,
                gitignore: true,
                ignore: ['**/node_modules/**', '**/.git/**'],
            })
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
            const siteId = docsJson?.siteId
            if (!siteId) {
                console.error('siteId not found in docs.json')
                return
            }
            const preferredHost = 'fumabase.com'
            const previewDomain = (docsJson?.domains || []).sort((a, b) => {
                const aIsFb = a.endsWith(preferredHost)
                const bIsFb = b.endsWith(preferredHost)
                if (aIsFb && !bIsFb) return -1
                if (!aIsFb && bIsFb) return 1
                return 0
            })[0]
            if (!previewDomain) {
                console.error(
                    `This docs.json has no domains, cannot preview the website`,
                )
                return
            }
            const githubBranch = getCurrentGitBranch()
            const [websocketRes] = await Promise.all([
                // apiClient.api.getPreviewUrlForSiteId.post({
                //     githubBranch,
                //     siteId,
                // }),
                startWebSocketWithTunnel(),
            ])

            const { websocketUrl, wss } = websocketRes

            const previewUrl = new URL(`https://${previewDomain}`)
            previewUrl.searchParams.set('websocketServer', websocketUrl)
            console.log(`opening ${previewUrl.toString()} in browser...`)
            openUrlInBrowser(previewUrl.toString())

            // Wait until there is at least one WebSocket connection before proceeding
            await new Promise<void>((resolve) => {
                wss.on('connection', () => resolve())
            })

            console.log(`browser connected, watching for files...`)
            wss.emit(JSON.stringify())

        } catch (error) {
            console.error(error)

            throw error
        }
    },
)
