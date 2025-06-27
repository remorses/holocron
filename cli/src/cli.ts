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

// const apiClient = createApiClient(url)

cli.command('init', 'Initialize a new fumabase project').action(() => {
    // I want to let people create a new website just by using the CLI instead of going to the website. How can I do that? Well, one thing is, sure, I need to connect the GitHub app and I need to create a login for the user. And this is, this requires a website so it's impossible.
    // Instead, what I can do is add an option for the user if they already have a GitHub repository. And in that case, I also remove the administration scope if possible. I also remove the app, which makes people that are scared to connect a GitHub app this way less scared. We also let them choose the repo after connecting the app. After they choose the repo, I would need to open a pull request that adds the docs.json. And then... And then... When the merge happens, the website becomes available. What if instead I push the docs.json directly to a branch I want? To use... Instead... I want... To use... Instead... ... That would be scary for them. Instead I can create a branch for the PR, push there with Docs.Jazel and then show a preview for that branch in the website dashboard.
    // Another option would be to use GitHub Action instead of GitHub App Connection. But that would limit me a lot, for example, for features where you can mention the bot. What if there is a variant of a website that is not connected to GitHub App? And I show the button to connect the GitHub App to keep it in sync. The website changes will be pushed directly to the website. And locally I would pull the changes. Using a special command pull. Using a special command pull. And during deployment I would need to tell the user if there are changes in the website on the database you should first pull instead of deploying. This way you can create a website just with a Google login. The Google login. The Google login. The Google login. The Google login. The Google login. The Google login. The Google login. The Google login. The Google login. The Google login. The Google login. The Google login. The Google login. The Google login. The Google login. The Google login. The Google login. The Google login. The Google login. The Google login. The Google login. The Google login. The Google login. The Google login. The Google login. The Google login.
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
            // Create watcher for file changes (chokidar v4 doesn't support globs)
            const watcher = chokidar.watch(dir, {
                // alwaysStat: true,
                ignored: /[\\/](node_modules|\.git|\.cache)[\\/]/,

                ignoreInitial: false,
                persistent: true,
            })

            const filePaths: string[] = []

            // Wait for initial scan to complete
            await new Promise<void>((resolve) => {
                watcher.on('add', (filePath) => {
                    if (
                        filePath.endsWith('.mdx') ||
                        filePath.endsWith('.md') ||
                        filePath.endsWith('meta.json') ||
                        filePath.endsWith('docs.json') ||
                        filePath.endsWith('styles.css')
                    ) {
                        // console.log(filePath)
                        filePaths.push(filePath)
                    }
                })
                watcher.on('ready', () => {
                    resolve()
                })
            })

            if (!filePaths.length) {
                console.error(`No files for project inside ${dir}`)
                process.exit(1)
            }

            console.log(
                `Found ${filePaths.length} file${filePaths.length === 1 ? '' : 's'}`,
            )
            const docsJson = await readTopLevelDocsJson(dir)
            if (!docsJson) {
                console.error(
                    'docs.json file not found at the project root. Use fumabase init to create a new project',
                )
                process.exit(1)
            }

            const siteId = docsJson?.siteId
            if (!siteId) {
                console.error('siteId not found in docs.json')
                process.exit(1)
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
                process.exit(1)
            }
            // const githubBranch = getCurrentGitBranch()
            const [websocketRes] = await Promise.all([
                // apiClient.api.getPreviewUrlForSiteId.post({
                //     githubBranch,
                //     siteId,
                // }),
                startWebSocketWithTunnel(),
            ])

            const { websocketUrl, wss } = websocketRes

            const previewUrl = new URL(
                previewDomain.includes('.localhost:')
                    ? `http://${previewDomain}`
                    : `https://${previewDomain}`,
            )
            previewUrl.searchParams.set('websocketUrl', websocketUrl)
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

                        const githubPath = path.posix.relative(
                            dir,
                            filePath.replace(/\\/g, '/'),
                        )
                        return [
                            githubPath,
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
            wss.on('connection', async (ws) => {
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

                for (const [key, value] of Object.entries(filesInDraft)) {
                    // console.log(`sending state to website for file: ${key}`)
                    await client.setDocsState({
                        filesInDraft: { [key]: value },
                    })
                }

                ws.on('close', () => {
                    connectedClients.delete(client)
                })
            })

            // Watch for file changes and additions
            const handleFileUpdate = async (filePath: string) => {
                const fullPath = path.resolve(dir, filePath)
                const content = await fs.promises.readFile(fullPath, 'utf-8')
                const githubPath = path.posix.relative(
                    dir,
                    filePath.replace(/\\/g, '/'),
                )

                // Update the local filesInDraft
                filesInDraft[githubPath] = {
                    content,
                    githubPath,
                }

                // Send only the updated file to all connected clients
                const updatedFile = { [githubPath]: filesInDraft[githubPath] }
                for (const client of connectedClients) {
                    console.log(`sending websocket update for ${githubPath}`)
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
                        console.log(`sending websocket message`)
                        client.setDocsState({ filesInDraft: deletedFile })
                    }
                }
            })
        } catch (error) {
            console.error(error)

            throw error
        }
    })
