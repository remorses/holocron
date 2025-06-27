import { cac } from 'cac'

import fs from 'fs'
import path from 'path'

import chokidar from 'chokidar'
import { createApiClient } from './generated/spiceflow-client.js'
import { startWebSocketWithTunnel } from './server.js'
import { createIframeRpcClient } from './setstate.js'
import {
    getCurrentGitBranch,
    openUrlInBrowser,
    readTopLevelDocsJson,
} from './utils.js'

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

cli.command('dev', 'Preview your fumabase website')
    .option('--dir <dir>', 'Directory with the docs.json', {
        default: process.cwd(),
    })
    .action(async function main(options) {
        // console.log({ options })
        let { dir } = options
        dir = path.resolve(dir)
        console.log(`finding files inside ${dir}`)
        try {
            const globs = [
                '**/*.md',
                '**/*.mdx',
                '**/meta.json',
                '**/docs.json',
            ]

            // Create watcher for file changes
            const watcher = chokidar.watch(globs, {
                cwd: dir,
                ignored: ['**/node_modules/**', '**/.git/**'],
                ignoreInitial: false,
                persistent: true,
            })

            const filePaths: string[] = []

            // Wait for initial scan to complete
            await new Promise<void>((resolve) => {
                watcher.on('add', (filePath) => {
                    filePaths.push(filePath)
                })
                watcher.on('ready', () => {
                    console.log(
                        `Found ${filePaths.length} file${filePaths.length === 1 ? '' : 's'}`,
                    )
                    resolve()
                })
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
                return
            }

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
            const connectedClients = new Set<
                ReturnType<typeof createIframeRpcClient>
            >()

            // Wait until there is at least one WebSocket connection before proceeding
            wss.on('connection', (ws) => {
                console.log(
                    `browser connected, showing a preview of your local changes`,
                )
                console.log(
                    `to deploy your changes to the production website simply push the changes on GitHub`,
                )
                console.log(
                    `fumabase will detect the updates and deploy a new version of the site`,
                )
                const client = createIframeRpcClient({ ws })
                connectedClients.add(client)
                client.setDocsState({ filesInDraft })

                ws.on('close', () => {
                    connectedClients.delete(client)
                })
            })

            // Watch for file changes and additions
            const handleFileUpdate = async (filePath: string) => {
                const fullPath = path.resolve(dir, filePath)
                const content = await fs.promises.readFile(fullPath, 'utf-8')
                const githubPath = filePath

                // Update the local filesInDraft
                filesInDraft[filePath] = {
                    content,
                    githubPath,
                }

                // Send only the updated file to all connected clients
                const updatedFile = { [filePath]: filesInDraft[filePath] }
                for (const client of connectedClients) {
                    client.setDocsState({ filesInDraft: updatedFile })
                }
            }

            watcher.on('add', handleFileUpdate)
            watcher.on('change', handleFileUpdate)

            watcher.on('unlink', (filePath) => {
                // Handle file deletion
                if (filesInDraft[filePath]) {
                    delete filesInDraft[filePath]

                    // Send null value to signal file deletion
                    const deletedFile = { [filePath]: null }
                    for (const client of connectedClients) {
                        client.setDocsState({ filesInDraft: deletedFile })
                    }
                }
            })
        } catch (error) {
            console.error(error)

            throw error
        }
    })
