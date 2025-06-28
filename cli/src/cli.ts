import { cac } from 'cac'

import fs from 'fs'
import path from 'path'
import { execSync } from 'child_process'
import { globby } from 'globby'

import chokidar from 'chokidar'
import { createApiClient } from './generated/spiceflow-client.js'
import { startWebSocketWithTunnel } from './server.js'
import { createIframeRpcClient } from './setstate.js'
import {
    getCurrentGitBranch,
    openUrlInBrowser,
    readTopLevelDocsJson,
    safeParseJson,
} from './utils.js'
import { randomInt } from 'crypto'
import { homedir } from 'os'
import prompts from 'prompts'

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
const configPath = path.join(homedir(), '.fumabase.json')

function getUserConfig() {
    try {
        const configData = fs.readFileSync(configPath, 'utf-8')
        return JSON.parse(configData)
    } catch (error) {
        throw new Error('Not logged in. Please run: fumabase login')
    }
}

function getGitHubInfo() {
    try {
        const remoteUrl = execSync('git remote get-url origin', { encoding: 'utf-8' }).trim()
        const match = remoteUrl.match(/github\.com[\/:]([^\/]+)\/([^\/\.]+)/)
        if (match) {
            return {
                githubOwner: match[1],
                githubRepo: match[2],
                name: match[2],
            }
        }
    } catch (error) {
        // No git remote or not a git repo
    }
    return null
}

const apiClient = createApiClient(url, {
    onRequest() {
        try {
            const config = getUserConfig()
            if (config.apiKey) {
                return {
                    headers: {
                        'x-api-key': config.apiKey,
                    },
                }
            }
        } catch (error) {
            // Continue without API key
        }
        
        return {}
    },
})

cli.command('init', 'Initialize a new fumabase project')
    .option('--name <name>', 'Name for the documentation site')
    .action(async (options) => {
        try {
            const config = getUserConfig()
            
            if (!config.apiKey || !config.orgs?.length) {
                console.log('You need to be logged in to initialize a project.')
                console.log('Please run: fumabase login')
                process.exit(1)
            }

            // Get GitHub info first
            const githubInfo = getGitHubInfo()
            
            // Get site name
            let siteName = options.name
            if (!siteName) {
                if (githubInfo?.name) {
                    siteName = githubInfo.name
                } else {
                    const response = await prompts({
                        type: 'text',
                        name: 'name',
                        message: 'What is the name of your documentation site?',
                        initial: path.basename(process.cwd()),
                    })
                    siteName = response.name
                }
            }

            if (!siteName) {
                console.log('Site name is required')
                process.exit(1)
            }

            // Select organization
            let orgId = config.orgs[0].orgId
            if (config.orgs.length > 1) {
                const response = await prompts({
                    type: 'select',
                    name: 'orgId',
                    message: 'Select an organization:',
                    choices: config.orgs.map((org) => ({
                        title: org.name || org.orgId,
                        value: org.orgId,
                    })),
                })
                orgId = response.orgId
            }

            if (!orgId) {
                console.log('Organization selection is required')
                process.exit(1)
            }

            // Get git branch
            const gitBranch = await getCurrentGitBranch()

            // Find files using globby
            const filePaths = await globby('**/*.{md,mdx,json,css}', {
                ignore: ['**/node_modules/**', '**/.git/**', '**/.cache/**'],
                gitignore: true,
            })

            if (!filePaths.length) {
                console.log('No files found matching pattern: **/*.{md,mdx,json,css}')
                process.exit(1)
            }

            console.log(`Found ${filePaths.length} files`)

            // Read file contents
            const files = await Promise.all(
                filePaths.map(async (filePath) => {
                    const content = await fs.promises.readFile(filePath, 'utf-8')
                    return {
                        relativePath: filePath,
                        contents: content,
                    }
                })
            )

            console.log('Creating site...')

            // Call the API
            const { data, error } = await apiClient.api.createSiteFromFiles.post({
                name: siteName,
                files,
                orgId,
                githubOwner: githubInfo?.githubOwner || '',
                githubRepo: githubInfo?.githubRepo || '',
                githubBranch: gitBranch || '',
            })

            if (error || !data?.success) {
                console.error('Failed to create site:', error?.message || 'Unknown error')
                process.exit(1)
            }

            // Save docs.json locally
            const docsJsonPath = path.join(process.cwd(), 'docs.json')
            await fs.promises.writeFile(
                docsJsonPath,
                JSON.stringify(data.docsJson, null, 2)
            )

            console.log('Site created successfully!')
            console.log(`docs.json saved to: ${docsJsonPath}`)
            console.log(`Site ID: ${data.siteId}`)
            console.log(`Branch ID: ${data.branchId}`)
            console.log('\nYou can now run: fumabase dev')

        } catch (error) {
            console.error('Error initializing project:', error.message || error)
            process.exit(1)
        }
    })

cli.command('login', 'Login to fumabase').action(async () => {
    const cliSessionSecret = Array.from({ length: 6 }, () =>
        randomInt(0, 10),
    ).join('')

    console.log('\nFumabase CLI Login')
    console.log('═'.repeat(50))

    console.log('\nVerification Code:')

    const formattedCode = cliSessionSecret.split('').join(' ')
    const padding = 3
    const contentWidth = formattedCode.length + padding * 2

    console.log(`\n    ╔${'═'.repeat(contentWidth)}╗`)
    console.log(
        `    ║${' '.repeat(padding)}${formattedCode}${' '.repeat(padding)}║`,
    )
    console.log(`    ╚${'═'.repeat(contentWidth)}╝`)
    console.log('\nMake sure this code matches the one shown in your browser.')
    console.log('═'.repeat(50))

    const loginUrl = new URL(`${url}/login`)
    loginUrl.searchParams.set(
        'callbackUrl',
        `/after-cli-login?cliSessionSecret=${cliSessionSecret}`,
    )
    const fullUrl = loginUrl.toString()

    console.log(`\nReady to open: ${fullUrl}`)

    const response = await prompts({
        type: 'confirm',
        name: 'openBrowser',
        message: 'Open browser to authorize CLI?',
        initial: true,
    })

    if (!response.openBrowser) {
        console.log(
            '\nLogin cancelled. You can manually open the URL above to continue.',
        )
        process.exit(0)
    }

    console.log('\nOpening browser...')
    openUrlInBrowser(fullUrl)

    console.log('\nWaiting for authorization...')

    const maxAttempts = 60
    let attempts = 0
    let dots = 0

    while (attempts < maxAttempts) {
        try {
            const { data, error } = await apiClient.api.getCliSession.post({
                secret: cliSessionSecret,
            })

            if (data?.apiKey) {
                const config = {
                    apiKey: data.apiKey,
                    userId: data.userId,
                    userEmail: data.userEmail,
                    orgs: data.orgs || [],
                }

                await fs.promises.writeFile(
                    configPath,
                    JSON.stringify(config, null, 2),
                )
                console.log('\nLogin successful!')
                console.log(`API key saved to: ${configPath}`)
                console.log(`Logged in as: ${data.userEmail}`)
                console.log('\nYou can now use the Fumabase CLI!')
                return
            }
        } catch (error) {
            // Continue polling
        }

        dots++

        await new Promise((resolve) => setTimeout(resolve, 2000))
        attempts++
    }

    console.error('\n\nLogin timeout. Please try again.')
    process.exit(1)
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

            const { websocketId, ws } = websocketRes

            const previewUrl = new URL(
                previewDomain.includes('.localhost:')
                    ? `http://${previewDomain}`
                    : `https://${previewDomain}`,
            )
            previewUrl.searchParams.set('websocketId', websocketId)
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

            // Create RPC client with the upstream WebSocket
            const client = createIframeRpcClient({ ws })

            // Wait for first message from browser before sending files

            console.log(`Waiting for browser to connect...`)
            ws.on('message', async (message) => {
                const string = message.toString()
                const data = safeParseJson(string)
                // send the full state only on first message from the browser
                if (data?.type !== 'ready') return
                console.log(
                    `browser connected, showing a preview of your local changes`,
                )
                console.log(
                    `to deploy your changes to the production website simply push the changes on GitHub`,
                )
                console.log(
                    `fumabase will detect the updates and deploy a new version of the site`,
                )

                // Send initial files state after browser is connected
                for (const [key, value] of Object.entries(filesInDraft)) {
                    // console.log(`sending state to website for file: ${key}`)
                    await client.setDocsState({
                        filesInDraft: { [key]: value },
                    })
                }
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

                // Send only the updated file through the tunnel to all browsers
                const updatedFile = { [githubPath]: filesInDraft[githubPath] }
                console.log(`sending websocket update for ${githubPath}`)
                client.setDocsState({ filesInDraft: updatedFile })
            }

            watcher.on('add', handleFileUpdate)
            watcher.on('change', handleFileUpdate)

            watcher.on('unlink', (filePath) => {
                // Handle file deletion
                if (filesInDraft[filePath]) {
                    delete filesInDraft[filePath]

                    // Send null value to signal file deletion
                    const deletedFile = { [filePath]: null }
                    console.log(`sending websocket message for deleted file`)
                    client.setDocsState({ filesInDraft: deletedFile })
                }
            })
        } catch (error) {
            console.error(error)

            throw error
        }
    })
