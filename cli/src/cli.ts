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
import { lookup } from 'mime-types'
import { Sema } from 'sema4'
import Table from 'cli-table3'
import { imageDimensionsFromData } from 'image-dimensions'
import { DocsJsonType } from 'docs-website/src/lib/docs-json.js'

export const cli = cac('fumabase')

cli.help()

type FilesInDraft = Record<
    string,
    {
        content: string
        githubPath: string
    }
>

type UserConfig = {
    apiKey: string
    userId: string
    userEmail: string
    orgs: Array<{
        orgId: string
        name?: string
    }>
    lastWebsocketId?: string
}

const url = process.env.SERVER_URL || 'https://fumabase.com'
const configPath = path.join(homedir(), '.fumabase.json')

// Check if running in TTY environment
const isTTY = process.stdout.isTTY && process.stdin.isTTY

function getUserConfig(): UserConfig {
    try {
        const configData = fs.readFileSync(configPath, 'utf-8')
        return JSON.parse(configData)
    } catch (error) {
        throw new Error('Not logged in. Please run: fumabase login')
    }
}

async function saveUserConfig(config: UserConfig): Promise<void> {
    await fs.promises.writeFile(configPath, JSON.stringify(config, null, 2))
}

// Media file extensions that should be uploaded
const MEDIA_EXTENSIONS = [
    'jpg',
    'jpeg',
    'png',
    'gif',
    'webp',
    'svg',
    'ico',
    'mp4',
    'webm',
    'mov',
    'avi',
    'mp3',
    'wav',
    'ogg',
    'pdf',
    'doc',
    'docx',
    'zip',
]

async function findProjectFiles() {
    // Find files using globby
    const filePaths = await globby(
        ['**/*.{md,mdx}', 'meta.json', 'styles.css'],
        {
            ignore: ['**/node_modules/**', '**/.git/**', '**/.cache/**'],
            gitignore: true,
        },
    )

    // Find media files separately
    const mediaFilePaths = await globby(
        [`**/*.{${MEDIA_EXTENSIONS.join(',')}}`],
        {
            ignore: ['**/node_modules/**', '**/.git/**', '**/.cache/**'],
            gitignore: true,
        },
    )

    // Read file contents for text files
    const files = await Promise.all(
        filePaths.map(async (filePath) => {
            const content = await fs.promises.readFile(filePath, 'utf-8')
            return {
                relativePath: filePath,
                contents: content,
            }
        }),
    )

    return { filePaths, files, mediaFilePaths }
}

async function uploadMediaFiles(mediaFilePaths: string[], siteId: string) {
    if (mediaFilePaths.length === 0) {
        return []
    }

    console.log(`Uploading ${mediaFilePaths.length} media files...`)

    // Prepare files for upload
    const filesToUpload = mediaFilePaths.map((filePath) => ({
        slug: filePath,
        contentType: getContentType(filePath),
    }))

    // Get signed URLs for upload
    const { data, error } = await apiClient.api.createUploadSignedUrl.post({
        siteId,
        files: filesToUpload,
    })

    if (error || !data?.success) {
        console.error(
            'Failed to get upload URLs:',
            error?.message || 'Unknown error',
        )
        return []
    }

    // Create semaphore to limit concurrent uploads (max 5 concurrent uploads)
    const sema = new Sema(5)

    // Upload each file with concurrency limiting
    const uploadPromises = data.files.map(async (fileInfo, index) => {
        await sema.acquire()

        try {
            const filePath = mediaFilePaths[index]
            const fileBuffer = await fs.promises.readFile(filePath)
            const contentType = getContentType(filePath)

            const response = await fetch(fileInfo.signedUrl, {
                method: 'PUT',
                body: fileBuffer,
                headers: {
                    'Content-Type': contentType,
                },
            })

            if (!response.ok) {
                console.error(
                    `Failed to upload ${filePath}: ${response.statusText}`,
                )
                return null
            }

            console.log(`✓ Uploaded ${filePath}`)
            return {
                relativePath: filePath,
                contents: '', // Empty contents for media files
                uploadedUrl: fileInfo.finalUrl,
            }
        } finally {
            sema.release()
        }
    })

    const uploadResults = await Promise.all(uploadPromises)
    const successfulUploads = uploadResults.filter(Boolean)

    console.log(`Successfully uploaded ${successfulUploads.length} media files`)
    return successfulUploads
}

function getContentType(filePath: string): string {
    return lookup(filePath) || 'application/octet-stream'
}

function getGitHubInfo() {
    try {
        const remoteUrl = execSync('git remote get-url origin', {
            encoding: 'utf-8',
        }).trim()
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

async function determineTemplateDownload({
    markdownFileCount,
    fromTemplateFlag,
    isInteractive,
}: {
    markdownFileCount: number
    fromTemplateFlag: boolean
    isInteractive: boolean
}): Promise<boolean> {
    if (fromTemplateFlag) {
        return true
    }

    if (markdownFileCount === 0) {
        if (!isInteractive) {
            console.error(
                'Error: No markdown files found in non-interactive environment',
            )
            console.error(
                'Use --from-template to download starter template files',
            )
            console.error('Usage: fumabase init --from-template')
            process.exit(1)
        }

        const response = await prompts({
            type: 'confirm',
            name: 'downloadTemplate',
            message:
                'No markdown files found. Do you want to download the starter template files in the current directory?',
            initial: true,
        })

        if (!response.downloadTemplate) {
            console.log(
                'Cannot initialize a fumabase project without markdown files.',
            )
            process.exit(1)
        }

        return true
    }

    if (markdownFileCount <= 1) {
        if (!isInteractive) {
            console.error(
                `Error: Found ${markdownFileCount} markdown file(s), but at least 2 are required`,
            )
            console.error(
                'Use --from-template to download starter template files, or add more markdown files',
            )
            console.error('Usage: fumabase init --from-template')
            process.exit(1)
        }

        const response = await prompts({
            type: 'select',
            name: 'choice',
            message: `Found ${markdownFileCount} markdown file(s), but at least 2 are required. What would you like to do?`,
            choices: [
                {
                    title: 'Use existing markdown files for the website',
                    value: 'continue',
                },
                { title: 'Download starter template files', value: 'template' },
            ],
        })

        if (response.choice === 'template') {
            return true
        }

        if (response.choice === 'continue') {
            console.log('Continuing with existing files...')
            return false
        }

        console.log('Operation cancelled.')
        process.exit(1)
    }

    return false
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

cli.command('init', 'Initialize or deploy a fumabase project')
    .option('--name <name>', 'Name for the documentation site')
    .option('--from-template', 'Download starter template files')
    .option('--org <orgId>', 'Organization ID to use')
    .option('--dir <dir>', 'Directory to initialize project in')
    .action(async (options) => {
        try {
            // Change to specified directory if provided
            if (options.dir) {
                const targetDir = path.resolve(options.dir)
                if (!fs.existsSync(targetDir)) {
                    fs.mkdirSync(targetDir, { recursive: true })
                }
                process.chdir(targetDir)
            }

            const docsJsonPath = path.join(options.dir, 'fumabase.json')
            let existingDocsJson = undefined as DocsJsonType | undefined
            try {
                const existingContent = await fs.promises.readFile(
                    docsJsonPath,
                    'utf-8',
                )
                existingDocsJson = JSON.parse(existingContent)
            } catch (error) {
                // File doesn't exist or invalid JSON, continue with new site creation
            }

            const config = getUserConfig()

            if (!config.apiKey || !config.orgs?.length) {
                console.log('You need to be logged in to initialize a project.')
                console.log('Please run: fumabase login')
                process.exit(1)
            }

            // Get GitHub info first
            const githubInfo = getGitHubInfo()

            // Get site name
            let siteName = options.name || existingDocsJson?.name
            if (!siteName) {
                if (githubInfo?.name) {
                    siteName = githubInfo.name
                } else if (!isTTY) {
                    console.error(
                        'Error: --name is required in non-interactive environments',
                    )
                    console.error('Usage: fumabase init --name "My Site Name"')
                    process.exit(1)
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
            let orgId = options.org || config.orgs[0].orgId
            if (!options.org && config.orgs.length > 1) {
                if (!isTTY) {
                    console.error(
                        'Error: --org is required when multiple organizations are available in non-interactive environments',
                    )
                    console.error('Available organizations:')
                    config.orgs.forEach((org) => {
                        console.error(
                            `  ${org.orgId} (${org.name || 'No name'})`,
                        )
                    })
                    console.error('Usage: fumabase init --org <orgId>')
                    process.exit(1)
                } else {
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
            }

            if (!orgId) {
                console.log('Organization selection is required')
                process.exit(1)
            }

            // Get git branch
            const gitBranch = await getCurrentGitBranch()

            // Find files using globby
            let { filePaths, files, mediaFilePaths } = await findProjectFiles()

            // Check markdown files and handle different scenarios
            const markdownFiles = filePaths.filter(
                (file) => file.endsWith('.md') || file.endsWith('.mdx'),
            )

            const shouldDownloadTemplate = await determineTemplateDownload({
                markdownFileCount: markdownFiles.length,
                fromTemplateFlag: options.fromTemplate,
                isInteractive: isTTY,
            })

            if (shouldDownloadTemplate) {
                console.log('Downloading starter template...')

                // Download starter template
                const { data, error } =
                    await apiClient.api.getStarterTemplate.get()
                if (error || !data?.success) {
                    console.error(
                        'Failed to download starter template:',
                        error?.message || 'Unknown error',
                    )
                    process.exit(1)
                }

                // Write starter template files to filesystem
                console.log(
                    `Writing ${data.files.length} starter template files...`,
                )
                for (const file of data.files) {
                    const filePath = file.relativePath
                    const dirPath = path.dirname(filePath)

                    // Create directories if they don't exist
                    if (dirPath !== '.') {
                        await fs.promises.mkdir(dirPath, { recursive: true })
                    }

                    // Handle files with downloadUrl (media files)
                    if (file.downloadUrl && !file.contents) {
                        try {
                            console.log(
                                `Downloading ${filePath} from ${file.downloadUrl}`,
                            )
                            const response = await fetch(file.downloadUrl)
                            if (!response.ok) {
                                console.error(
                                    `Failed to download ${filePath}: ${response.statusText}`,
                                )
                                continue
                            }
                            const buffer = await response.arrayBuffer()
                            await fs.promises.writeFile(
                                filePath,
                                Buffer.from(buffer),
                            )
                        } catch (error) {
                            console.error(
                                `Error downloading ${filePath}:`,
                                error.message,
                            )
                            continue
                        }
                    } else {
                        // Write text file
                        await fs.promises.writeFile(
                            filePath,
                            file.contents,
                            'utf-8',
                        )
                    }
                }

                console.log('Starter template files written successfully!')

                // Re-run file discovery
                const result = await findProjectFiles()
                filePaths = result.filePaths
                files = result.files
                mediaFilePaths = result.mediaFilePaths
            }

            console.log(`Found ${filePaths.length} files`)
            if (mediaFilePaths.length > 0) {
                console.log(`Found ${mediaFilePaths.length} media files`)
            }

            console.log('Creating site...')

            // Process media files to get metadata
            const mediaFilesWithMetadata = await Promise.all(
                mediaFilePaths.map(async (filePath) => {
                    const fileBuffer = await fs.promises.readFile(filePath)
                    const bytes = fileBuffer.length

                    let width: number | undefined
                    let height: number | undefined

                    try {
                        const dimensions = imageDimensionsFromData(fileBuffer)
                        if (dimensions) {
                            width = dimensions.width
                            height = dimensions.height
                        }
                    } catch (error) {
                        // Not an image or couldn't get dimensions
                    }

                    return {
                        relativePath: filePath,
                        contents: '',
                        metadata: {
                            width,
                            height,
                            bytes,
                        },
                    }
                }),
            )

            // Call the API to create or update site
            const { data, error } =
                await apiClient.api.upsertSiteFromFiles.post({
                    name: siteName,
                    files: [...files, ...mediaFilesWithMetadata],
                    orgId,
                    githubOwner: githubInfo?.githubOwner || '',
                    githubRepo: githubInfo?.githubRepo || '',
                    githubBranch: gitBranch || '',
                    siteId: existingDocsJson?.siteId,
                })

            if (error || !data?.success) {
                console.error(
                    'Failed to create site:',
                    error?.message || 'Unknown error',
                )
                process.exit(1)
            }

            // Upload media files if any exist
            if (mediaFilePaths.length > 0) {
                await uploadMediaFiles(mediaFilePaths, data.siteId)
            }

            // Display any page processing errors
            const errors = data.errors
            if (errors && errors.length > 0) {
                console.log('\nPage Processing Errors:')

                const errorTable = new Table({
                    head: ['File', 'Error Message'],
                    colWidths: [40, 60],
                    style: {
                        head: ['red', 'bold'],
                        border: ['grey'],
                    },
                })

                for (const error of errors) {
                    errorTable.push([
                        `${error.githubPath}:${error.line}`,
                        error.errorMessage,
                    ])
                }

                console.log(errorTable.toString())
                console.log(
                    `\nFound ${errors.length} error(s) in your documentation files.`,
                )
                console.log('Fix the issues above and run the command again.\n')
            }

            // Save fumabase.json locally
            await fs.promises.writeFile(
                docsJsonPath,
                JSON.stringify(data.docsJson, null, 2),
            )

            // Create success table
            const isUpdate = existingDocsJson?.siteId
            console.log(
                `\n✅ Site ${isUpdate ? 'updated' : 'created'} successfully!\n`,
            )

            const table = new Table({
                head: ['Property', 'Value'],
                colWidths: [20, 50],
                style: {
                    head: ['cyan', 'bold'],
                    border: ['grey'],
                },
            })

            // Extract website URL from docsJson
            const domains = data.docsJson?.domains || []
            const websiteUrl =
                domains.length > 0
                    ? `https://${domains[0]}`
                    : 'No domain configured yet'

            table.push(
                ['Site Name', siteName],
                ['Site ID', data.siteId],
                ['Branch ID', data.branchId],
                ['Website URL', websiteUrl],
                ['Organization', orgId],
                ['Config File', docsJsonPath],
                [
                    'Files Uploaded',
                    `${filePaths.length} text files${mediaFilePaths.length > 0 ? `, ${mediaFilePaths.length} media files` : ''}`,
                ],
            )

            if (githubInfo) {
                table.push(
                    [
                        'GitHub',
                        `${githubInfo.githubOwner}/${githubInfo.githubRepo}`,
                    ],
                    ['Branch', gitBranch || 'main'],
                )
            }

            console.log(table.toString())

            console.log('\n🚀 Next steps:')
            console.log('   1. Run: fumabase dev')
            console.log('   2. Open your browser to preview changes')
            console.log('   3. Push to GitHub to deploy automatically\n')
        } catch (error) {
            console.error('Error initializing project:', error.message || error)
            process.exit(1)
        }
    })

cli.command('login', 'Login to fumabase')
    .option('--no-browser', 'Skip automatic browser opening')
    .action(async (options) => {
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
        console.log(
            '\nMake sure this code matches the one shown in your browser.',
        )
        console.log('═'.repeat(50))

        const loginUrl = new URL(`${url}/login`)
        loginUrl.searchParams.set(
            'callbackUrl',
            `/after-cli-login?cliSessionSecret=${cliSessionSecret}`,
        )
        const fullUrl = loginUrl.toString()

        console.log(`\nReady to open: ${fullUrl}`)

        let shouldOpenBrowser = !options.noBrowser

        if (!options.noBrowser && !isTTY) {
            console.log('\nNon-interactive environment detected.')
            console.log(
                'Please manually open the URL above in your browser to continue.',
            )
            shouldOpenBrowser = false
        } else if (!options.noBrowser && isTTY) {
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
        }

        if (shouldOpenBrowser) {
            console.log('\nOpening browser...')
            openUrlInBrowser(fullUrl)
        }

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
                    const config: UserConfig = {
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
                    console.log('\nRun `fumabase init` to start a new project')
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
    .option('--dir <dir>', 'Directory with the fumabase.json', {
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
                    const isTextFile =
                        filePath.endsWith('.mdx') ||
                        filePath.endsWith('.md') ||
                        filePath.endsWith('meta.json') ||
                        filePath.endsWith('fumabase.json') ||
                        filePath.endsWith('styles.css')

                    const isMediaFile = MEDIA_EXTENSIONS.some((ext) =>
                        filePath.toLowerCase().endsWith(`.${ext}`),
                    )

                    if (isTextFile || isMediaFile) {
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
                    'fumabase.json file not found at the project root. Use fumabase init to create a new project',
                )
                process.exit(1)
            }

            const siteId = docsJson?.siteId
            if (!siteId) {
                console.error('siteId not found in fumabase.json')
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
                    `This fumabase.json has no domains, cannot preview the website`,
                )
                process.exit(1)
            }
            // const githubBranch = getCurrentGitBranch()

            // Get config to check for lastWebsocketId
            let config: UserConfig | null = null
            try {
                config = getUserConfig()
            } catch (error) {
                // Ignore error if not logged in, dev command can work without login
            }

            const [websocketRes] = await Promise.all([
                // apiClient.api.getPreviewUrlForSiteId.post({
                //     githubBranch,
                //     siteId,
                // }),
                startWebSocketWithTunnel(config?.lastWebsocketId),
            ])

            const { websocketId, ws } = websocketRes

            // Save the websocket ID for next time if we have a config
            if (config && websocketId !== config.lastWebsocketId) {
                config.lastWebsocketId = websocketId
                await saveUserConfig(config)
            }

            const previewUrl = new URL(
                previewDomain.includes('.localhost:') ||
                previewDomain.endsWith('.localhost')
                    ? `http://${previewDomain}:7777`
                    : `https://${previewDomain}`,
            )
            previewUrl.searchParams.set('websocketId', websocketId)
            console.log(`opening ${previewUrl.toString()} in browser...`)
            openUrlInBrowser(previewUrl.toString())

            const filesInDraft: FilesInDraft = Object.fromEntries(
                await Promise.all(
                    filePaths.map(async (filePath) => {
                        const fullPath = path.resolve(dir, filePath)

                        // Check if it's a media file
                        const isMediaFile = MEDIA_EXTENSIONS.some((ext) =>
                            filePath.toLowerCase().endsWith(`.${ext}`),
                        )

                        // For media files, use empty content (they're handled separately)
                        const content = isMediaFile
                            ? ''
                            : await fs.promises.readFile(fullPath, 'utf-8')

                        const githubPath = path.posix.relative(
                            dir,
                            filePath.replace(/\\\\/g, '/'),
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

                // Check if it's a media file
                const isMediaFile = MEDIA_EXTENSIONS.some((ext) =>
                    filePath.toLowerCase().endsWith(`.${ext}`),
                )

                // For media files, use empty content (they're handled separately)
                const content = isMediaFile
                    ? ''
                    : await fs.promises.readFile(fullPath, 'utf-8')
                const githubPath = path.posix.relative(
                    dir,
                    filePath.replace(/\\\\/g, '/'),
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

cli.command('sync', 'Sync current branch with GitHub').action(async () => {
    try {
        const config = getUserConfig()

        // Get current git branch
        const gitBranch = await getCurrentGitBranch()
        if (!gitBranch) {
            console.error('Error: Cannot determine current git branch')
            console.error(
                'Make sure you are in a git repository with a valid branch',
            )
            process.exit(1)
        }

        // Check for uncommitted changes
        try {
            const gitStatus = execSync('git status --porcelain', {
                encoding: 'utf-8',
            }).trim()

            if (gitStatus) {
                console.error('Error: You have uncommitted changes')
                console.error(
                    'The sync command only syncs files that are already pushed to GitHub',
                )
                console.error(
                    'Please commit and push your changes first before running sync',
                )
                process.exit(1)
            }
        } catch (error) {
            console.error('Error checking git status:', error.message)
            process.exit(1)
        }

        // Check for unpushed commits
        try {
            const unpushedCommits = execSync(
                `git log origin/${gitBranch}..${gitBranch} --oneline`,
                { encoding: 'utf-8' },
            ).trim()

            if (unpushedCommits) {
                console.error('Error: You have unpushed commits')
                console.error(
                    'The sync command only syncs files that are already pushed to GitHub',
                )
                console.error(
                    'Please push your commits first before running sync',
                )
                console.error('\nUnpushed commits:')
                console.error(unpushedCommits)
                process.exit(1)
            }
        } catch (error) {
            // If the command fails, it might be because the remote branch doesn't exist
            // In that case, we should still inform the user
            if (error.message.includes('unknown revision')) {
                console.error('Error: Remote branch not found')
                console.error(
                    'Please push your branch to GitHub first before running sync',
                )
                process.exit(1)
            }
            // For other errors, just continue - the sync might still work
        }

        // Get GitHub info to validate this is a GitHub repo
        const githubInfo = getGitHubInfo()
        if (!githubInfo) {
            console.error(
                'Error: Cannot determine GitHub repository information',
            )
            console.error(
                'Make sure you are in a GitHub repository with a valid remote origin',
            )
            process.exit(1)
        }

        // Read fumabase.json to get siteId
        const docsJson = await readTopLevelDocsJson(process.cwd())
        if (!docsJson?.siteId) {
            console.error('Error: fumabase.json not found or missing siteId')
            console.error('Run "fumabase init" to initialize this project')
            process.exit(1)
        }

        const siteId = docsJson.siteId

        console.log(`Syncing branch "${gitBranch}" for site ${siteId}...`)

        // Call the sync API
        const { data, error } = await apiClient.api.githubSync.post({
            siteId,
            githubBranch: gitBranch,
        })

        if (error) {
            console.error('Sync failed:', error.message || 'Unknown error')
            process.exit(1)
        }

        if (data?.success) {
            console.log('✅ Sync completed successfully!')
            console.log(`Site ID: ${data.siteId}`)
            console.log(`Branch ID: ${data.branchId}`)
            console.log(`GitHub Branch: ${data.githubBranch}`)
        } else {
            console.error('Sync failed: Invalid response from server')
            process.exit(1)
        }
    } catch (error) {
        console.error('Error during sync:', error.message || error)
        process.exit(1)
    }
})
