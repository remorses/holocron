import { cac } from 'cac'
import JSONC from 'tiny-jsonc'
import pc from 'picocolors'

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
  getGitRepoRoot,
  getGitHubInfo,
  checkGitStatus,
  DOCS_JSON_BASENAME,
  isDocsJson,
} from './utils.js'
import { randomInt } from 'crypto'
import { homedir } from 'os'
import prompts from 'prompts'
import { lookup } from 'mime-types'
import { Sema } from 'sema4'
import Table from 'cli-table3'
import { imageDimensionsFromData } from 'image-dimensions'
import { DocsJsonType } from './docs-json.js'

export const cli = cac('holocron')
const url = process.env.SERVER_URL || 'https://holocron.so'
const configPath = path.join(homedir(), `.holocron-config.json`)

const apiClient = createApiClient(url, {
  onRequest() {
    const config = getUserConfig()
    if (config?.apiKey) {
      return {
        headers: {
          'x-api-key': config.apiKey,
        },
      }
    }

    return {}
  },
})


cli.help()

type FilesInDraft = Record<
  string,
  {
    content: string | null
    deletedLines?: number
    addedLines?: number
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
  websocketIds?: Record<string, string> // Map of siteId to websocketId
}



// Check if running in TTY environment
const isTTY = process.stdout.isTTY && process.stdin.isTTY

function getUserConfig(): UserConfig | null {
  try {
    const configData = fs.readFileSync(configPath, 'utf-8')
    return JSON.parse(configData)
  } catch (error) {
    return null
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

async function findProjectFiles(workingDir: string = process.cwd()) {
  const repoRoot = getGitRepoRoot()
  if (!repoRoot) {
    throw new Error('Not inside a git repository')
  }

  // Calculate githubFolder - the relative path from repo root to working directory
  const githubFolder = path.posix.relative(repoRoot, workingDir) || '.'
  // console.log({ githubFolder, repoRoot })
  // process.exit(0)

  try {
    // Find files using globby
    const filePaths = await globby(['**/*.{md,mdx}', 'meta.json', 'styles.css'], {
      ignore: ['**/node_modules/**', '**/.git/**', '**/.cache/**'],
      gitignore: true,
      absolute: true,
    })

    // Find media files separately
    const mediaFilePaths = await globby([`**/*.{${MEDIA_EXTENSIONS.join(',')}}`], {
      ignore: ['**/node_modules/**', '**/.git/**', '**/.cache/**'],
      gitignore: true,
      absolute: true,
    })

    // Read file contents for text files
    const files = await Promise.all(
      filePaths.map(async (filePath) => {
        const content = await fs.promises.readFile(filePath, 'utf-8')
        return {
          absFilePath: filePath,

          contents: content,
        }
      }),
    )

    return {
      filePaths,
      files,
      mediaFilePaths: mediaFilePaths.map((x) => {
        const absFilePath = x
        const slug = '/' + path.relative(workingDir, absFilePath)
        return {
          absFilePath,
          slug,
        }
      }),
      githubFolder,
      repoRoot,
    }
  } finally {
  }
}

async function uploadMediaFiles({
  mediaFilePaths,
  siteId,
}: {
  mediaFilePaths: { slug: string; absFilePath: string }[]
  siteId: string
}) {
  if (mediaFilePaths.length === 0) {
    return []
  }

  console.log(pc.blue(`Uploading ${mediaFilePaths.length} media files...`))

  // Prepare files for upload
  const filesToUpload = mediaFilePaths.map((x) => ({
    slug: x.slug,
    contentLength: fs.statSync(x.absFilePath).size,
    contentType: getContentType(x.absFilePath),
  }))

  // Get signed URLs for upload
  const { data, error } = await apiClient.api.createUploadSignedUrl.post({
    siteId,
    files: filesToUpload,
  })

  if (error || !data?.success) {
    console.error(pc.red('Failed to get upload URLs: ' + (error?.message || 'Unknown error')))
    return []
  }

  // Create semaphore to limit concurrent uploads (max 5 concurrent uploads)
  const sema = new Sema(5)

  // Upload each file with concurrency limiting
  const uploadPromises = data.files.map(async (fileInfo, index) => {
    await sema.acquire()

    try {
      const filePath = mediaFilePaths[index]?.absFilePath
      const fileBuffer = await fs.promises.readFile(filePath)
      const contentType = getContentType(filePath)

      const response = await fetch(fileInfo.signedUrl, {
        method: 'PUT',
        body: fileBuffer as any,
        headers: {
          'Content-Type': contentType,
        },
      })

      if (!response.ok) {
        console.error(pc.red(`Failed to upload ${path.basename(filePath)}: ${response.statusText}`))
        return null
      }

      console.log(pc.green(`  Uploaded ${path.basename(filePath)}`))
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

  console.log(pc.green(`Successfully uploaded ${successfulUploads.length} media files`))
  return successfulUploads
}

function getContentType(filePath: string): string {
  return lookup(filePath) || 'application/octet-stream'
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
      console.error('Error: No markdown files found in non-interactive environment')
      console.error('Use --from-template to download starter template files')
      console.error('Usage: holocron init --from-template')
      process.exit(1)
    }

    const response = await prompts({
      type: 'confirm',
      name: 'downloadTemplate',
      message: 'No markdown files found. Do you want to download the starter template files in the current directory?',
      initial: true,
    })

    if (!response.downloadTemplate) {
      console.log('Cannot initialize a holocron project without markdown files.')
      process.exit(1)
    }

    return true
  }

  if (markdownFileCount < 1) {
    if (!isInteractive) {
      console.error(`Error: Found ${markdownFileCount} markdown file(s), but at least 1 is required`)
      console.error('Use --from-template to download starter template files, or add more markdown files')
      console.error('Usage: holocron init --from-template')
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

cli
  .command('init', 'Initialize or deploy a holocron project')
  .option('--name <name>', 'Name for the documentation site')
  .option('--from-template', 'Download starter template files')
  .option('--org <orgId>', 'Organization ID to use')
  .option('--dir <dir>', 'Directory to initialize project in')
  .action(async (options) => {
    try {
      const repoRoot = getGitRepoRoot()
      if (!repoRoot) {
        throw new Error('Not inside a git repository')
      }
      // Change to specified directory if provided
      if (options.dir) {
        const targetDir = path.resolve(options.dir)
        if (!fs.existsSync(targetDir)) {
          fs.mkdirSync(targetDir, { recursive: true })
        }
        process.chdir(targetDir)
      }

      const docsJsonPath = path.resolve(DOCS_JSON_BASENAME)
      let existingDocsJson = undefined as DocsJsonType | undefined
      try {
        const existingContent = await fs.promises.readFile(docsJsonPath, 'utf-8')
        existingDocsJson = JSONC.parse(existingContent)
      } catch (error) {
        // File doesn't exist or invalid JSON, continue with new site creation
      }

      const config = getUserConfig()

      if (!config || !config.apiKey || !config.orgs?.length) {
        console.log(pc.red('\nYou need to be logged in to initialize a project.'))
        console.log(pc.cyan('Please run: holocron login'))
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
          console.error('Error: --name is required in non-interactive environments')
          console.error('Usage: holocron init --name "My Site Name"')
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
            console.error(`  ${org.orgId} (${org.name || 'No name'})`)
          })
          console.error('Usage: holocron init --org <orgId>')
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
      let { filePaths, files, mediaFilePaths, githubFolder } = await findProjectFiles()

      // Check markdown files and handle different scenarios
      const markdownFiles = filePaths.filter((file) => file.endsWith('.md') || file.endsWith('.mdx'))

      const shouldDownloadTemplate = await determineTemplateDownload({
        markdownFileCount: markdownFiles.length,
        fromTemplateFlag: options.fromTemplate,
        isInteractive: isTTY,
      })

      if (shouldDownloadTemplate) {
        console.log(pc.blue('\nDownloading starter template...'))

        // Download starter template
        const { data, error } = await apiClient.api.getStarterTemplate.get()
        if (error || !data?.success) {
          console.error('Failed to download starter template:', error?.message || 'Unknown error')
          process.exit(1)
        }

        // Write starter template files to filesystem
        console.log(pc.blue(`Writing ${data.files.length} starter template files...`))
        for (const file of data.files) {
          const filePath = file.filePath
          const dirPath = path.dirname(filePath)

          // Create directories if they don't exist
          if (dirPath !== '.') {
            await fs.promises.mkdir(dirPath, { recursive: true })
          }

          // Handle files with downloadUrl (media files)
          if ('downloadUrl' in file && file.downloadUrl && !file.content) {
            try {
              console.log(pc.gray(`  → Downloading ${filePath}`))
              const response = await fetch((file as any).downloadUrl)
              if (!response.ok) {
                console.error(`Failed to download ${filePath}: ${response.statusText}`)
                continue
              }
              const buffer = await response.arrayBuffer()
              await fs.promises.writeFile(filePath, Buffer.from(buffer))
            } catch (error) {
              console.error(`Error downloading ${filePath}:`, error.message)
              continue
            }
          } else {
            // Write text file
            await fs.promises.writeFile(filePath, file.content, 'utf-8')
          }
        }

        console.log(pc.green('Starter template files written successfully!'))

        // Re-run file discovery
        const result = await findProjectFiles()
        filePaths = result.filePaths
        files = result.files
        mediaFilePaths = result.mediaFilePaths
      }

      console.log(pc.gray(`Found ${filePaths.length} files`))
      if (mediaFilePaths.length > 0) {
        console.log(pc.gray(`Found ${mediaFilePaths.length} media files`))
      }

      if (existingDocsJson?.siteId) {
        console.log(pc.blue('\nUpdating site...'))
      } else {
        console.log(pc.blue('\nCreating site...'))
      }

      // Process media files to get metadata
      const mediaFilesWithMetadata = await Promise.all(
        mediaFilePaths.map(async (x) => {
          const fileBuffer = await fs.promises.readFile(x.absFilePath)
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
            relativePath: path.relative(repoRoot, x.absFilePath),
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
      const { data, error } = await apiClient.api.upsertSiteFromFiles.post({
        name: siteName,
        files: [
          ...files.map((x) => {
            return {
              ...x,
              relativePath: path.relative(repoRoot, x.absFilePath),
            }
          }),
          ...mediaFilesWithMetadata,
        ],
        orgId,
        githubOwner: githubInfo?.githubOwner || '',
        githubRepo: githubInfo?.githubRepo || '',
        githubBranch: gitBranch || '',
        githubFolder,
        siteId: existingDocsJson?.siteId,
      })

      if (error || !data?.success) {
        console.error(pc.red('Failed to create site: ' + (error?.message || 'Unknown error')))
        process.exit(1)
      }

      // Upload media files if any exist
      if (mediaFilePaths.length > 0) {
        console.log(pc.blue(`\nUploading ${mediaFilePaths.length} media files...`))
        await uploadMediaFiles({ mediaFilePaths, siteId: data.siteId })
      }

      // Display any page processing errors
      const errors = data.errors
      if (errors && errors.length > 0) {
        console.log(pc.red('\nPage Processing Errors:'))

        const errorTable = new Table({
          head: ['File', 'Error Message'],
          colWidths: [40, 60],
          style: {
            head: ['red', 'bold'],
            border: ['grey'],
          },
        })

        for (const error of errors) {
          let relativePath = error.githubPath
          if (relativePath.startsWith(githubFolder + '/')) {
            relativePath = relativePath.slice(githubFolder.length + 1)
          }
          errorTable.push([`${relativePath}:${error.line}`, error.errorMessage])
        }

        console.log(errorTable.toString())
        console.log(pc.red(`\nFound ${errors.length} error(s) in your documentation files.`))
        console.log(pc.yellow('Fix the issues above and run the command again.\n'))
      }

      // Save docs json locally
      await fs.promises.writeFile(docsJsonPath, data.docsJsonWithComments)

      // Create success table
      const isUpdate = existingDocsJson?.siteId
      console.log(pc.green(`\nSite ${isUpdate ? 'updated' : 'created'} successfully!\n`))

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
      const websiteUrl = domains.length > 0 ? `https://${domains[0]}` : 'No domain configured yet'

      table.push(
        ['Site Name', siteName],
        ['Website URL', websiteUrl],
        [
          'Files Uploaded',
          `${filePaths.length} text files${mediaFilePaths.length > 0 ? `, ${mediaFilePaths.length} media files` : ''}`,
        ],
        ['GitHub', `${data.githubOwner}/${data.githubRepo}/${data.githubFolder}`],
        ['Branch', gitBranch || 'main'],
      )

      console.log(table.toString())

      console.log(pc.cyan('\nNext steps:'))
      console.log(pc.gray('   1. ') + pc.cyan('Run: holocron dev'))
      console.log(pc.gray('   2. ') + pc.cyan('Open your browser to preview changes'))
      console.log(pc.gray('   3. ') + pc.cyan('Push to GitHub to deploy automatically\n'))
    } catch (error) {
      console.error(pc.red('\nError initializing project:'))
      console.error(pc.red(error))
      process.exit(1)
    }
  })

cli
  .command('login', 'Login to holocron')
  .option('--no-browser', 'Skip automatic browser opening')
  .action(async (options) => {
    // Check if there's an existing user logged in
    const existingConfig = getUserConfig()
    if (existingConfig?.userEmail) {
      console.log(pc.yellow(`\nNote: You are currently logged in as ${existingConfig.userEmail}`))
      console.log(pc.gray('This will replace the existing login.\n'))
    }

    const cliSessionSecret = Array.from({ length: 6 }, () => randomInt(0, 10)).join('')

    // Display ASCII art for holocron
    console.log('\n')
    console.log(
      pc.cyan(
        [
          '  ██╗  ██╗ ██████╗ ██╗      ██████╗  ██████╗██████╗  ██████╗ ███╗   ██╗',
          '  ██║  ██║██╔═══██╗██║     ██╔═══██╗██╔════╝██╔══██╗██╔═══██╗████╗  ██║',
          '  ███████║██║   ██║██║     ██║   ██║██║     ██████╔╝██║   ██║██╔██╗ ██║',
          '  ██╔══██║██║   ██║██║     ██║   ██║██║     ██╔══██╗██║   ██║██║╚██╗██║',
          '  ██║  ██║╚██████╔╝███████╗╚██████╔╝╚██████╗██║  ██║╚██████╔╝██║ ╚████║',
          '  ╚═╝  ╚═╝ ╚═════╝ ╚══════╝ ╚═════╝  ╚═════╝╚═╝  ╚═╝ ╚═════╝ ╚═╝  ╚═══╝',
        ].join('\n'),
      ),
    )
    console.log(pc.gray('\n                      Documentation that just works'))
    console.log('\n' + pc.gray('═'.repeat(70)))
    console.log(pc.bold('                             CLI LOGIN'))
    console.log(pc.gray('═'.repeat(70)))

    console.log(pc.bold('\nVerification Code:'))

    const formattedCode = cliSessionSecret.split('').join(' ')
    const padding = 3
    const contentWidth = formattedCode.length + padding * 2

    console.log(`\n    ╔${'═'.repeat(contentWidth)}╗`)
    console.log(`    ║${' '.repeat(padding)}${formattedCode}${' '.repeat(padding)}║`)
    console.log(`    ╚${'═'.repeat(contentWidth)}╝`)
    console.log(pc.yellow('\nMake sure this code matches the one shown in your browser.'))
    console.log(pc.gray('═'.repeat(50)))

    const loginUrl = new URL(`${url}/login`)
    loginUrl.searchParams.set('callbackUrl', `/after-cli-login?cliSessionSecret=${cliSessionSecret}`)
    const fullUrl = loginUrl.toString()

    console.log(pc.gray(`\nReady to open: ${fullUrl}`))

    let shouldOpenBrowser = !options.noBrowser

    if (!options.noBrowser && !isTTY) {
      console.log('\nNon-interactive environment detected.')
      console.log('Please manually open the URL above in your browser to continue.')
      shouldOpenBrowser = false
    } else if (!options.noBrowser && isTTY) {
      const response = await prompts({
        type: 'confirm',
        name: 'openBrowser',
        message: 'Open browser to authorize CLI?',
        initial: true,
      })

      if (!response.openBrowser) {
        console.log('\nLogin cancelled. You can manually open the URL above to continue.')
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
            // Reset websocketIds when logging in as a new user
            websocketIds: existingConfig?.userId === data.userId ? existingConfig.websocketIds : undefined,
          }

          await fs.promises.writeFile(configPath, JSON.stringify(config, null, 2))

          if (existingConfig?.userEmail && existingConfig.userEmail !== data.userEmail) {
            console.log(pc.green('\nLogin successful!'))
            console.log(pc.gray(`Replaced previous login (${existingConfig.userEmail})`))
          } else {
            console.log(pc.green('\nLogin successful!'))
          }

          console.log(pc.gray(`API key saved to: ${configPath}`))
          console.log(pc.blue(`Logged in as: ${data.userEmail}`))
          console.log(pc.cyan('\nRun `holocron init` to start a new project'))
          return
        }
      } catch (error) {
        // Continue polling
      }

      dots++

      await new Promise((resolve) => setTimeout(resolve, 1000))
      attempts++
    }

    console.error(pc.red('\nLogin timeout. Please try again.'))
    process.exit(1)
  })

cli
  .command('dev', 'Preview your holocron website')
  .option('--dir <dir>', `Directory with the ${DOCS_JSON_BASENAME}`)
  .action(async (options) => {
    let { dir = process.cwd() } = options
    dir = path.resolve(dir)

    // Get git repository root for calculating relative paths
    const repoRoot = getGitRepoRoot()
    if (!repoRoot) {
      console.error(pc.red('Error: Not inside a git repository'))
      process.exit(1)
    }

    // Calculate githubFolder relative to repo root
    const githubFolder = path.posix.relative(repoRoot, dir) || '.'

    console.log(pc.blue(`Finding files inside ${dir}, relative to ${githubFolder || '.'}`))
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
        const cb = (filePath: string) => {
          const isTextFile =
            filePath.endsWith('.mdx') ||
            filePath.endsWith('.md') ||
            filePath.endsWith('meta.json') ||
            isDocsJson(filePath) ||
            filePath.endsWith('styles.css')

          const isMediaFile = MEDIA_EXTENSIONS.some((ext) => filePath.toLowerCase().endsWith(`.${ext}`))

          if (isTextFile || isMediaFile) {
            // console.log(filePath)
            filePaths.push(filePath)
          }
        }
        watcher.on('add', cb)
        watcher.on('ready', () => {
          watcher.off('add', cb)
          resolve()
        })
      })

      if (!filePaths.length) {
        console.error(pc.red(`No files for project inside ${dir}`))
        process.exit(1)
      }

      console.log(pc.gray(`Found ${filePaths.length} file${filePaths.length === 1 ? '' : 's'}`))
      const docsJson = await readTopLevelDocsJson(dir)
      if (!docsJson) {
        console.error(
          pc.red(`${DOCS_JSON_BASENAME} file not found at the project root. Use holocron init to create a new project`),
        )
        process.exit(1)
      }

      const siteId = docsJson?.siteId
      if (!siteId) {
        console.error(pc.red(`siteId not found in ${DOCS_JSON_BASENAME}`))
        process.exit(1)
      }
      const preferredHost = 'holocron.so'
      const previewDomain = (docsJson?.domains || []).sort((a, b) => {
        const aIsFb = a.endsWith(preferredHost)
        const bIsFb = b.endsWith(preferredHost)
        if (aIsFb && !bIsFb) return -1
        if (!aIsFb && bIsFb) return 1
        return 0
      })[0]
      if (!previewDomain) {
        console.error(pc.red(`This ${DOCS_JSON_BASENAME} has no domains, cannot preview the website`))
        process.exit(1)
      }
      // const githubBranch = getCurrentGitBranch()

      // Get config to check for lastWebsocketId
      const config = getUserConfig()

      const [websocketRes] = await Promise.all([
        // apiClient.api.getPreviewUrlForSiteId.post({
        //     githubBranch,
        //     siteId,
        // }),
        startWebSocketWithTunnel(config?.websocketIds?.[siteId]),
      ])

      const { websocketId, ws } = websocketRes

      // Save the websocket ID for next time if we have a config
      if (config && websocketId !== config.websocketIds?.[siteId]) {
        if (!config.websocketIds) {
          config.websocketIds = {}
        }
        config.websocketIds[siteId] = websocketId
        await saveUserConfig(config)
      }

      const previewUrl = new URL(
        previewDomain.includes('.localhost:') || previewDomain.endsWith('.localhost')
          ? `http://${previewDomain}:7777`
          : `https://${previewDomain}`,
      )
      previewUrl.searchParams.set('websocketId', websocketId)
      console.log(pc.cyan(`Opening ${previewUrl.toString()} in browser...`))
      openUrlInBrowser(previewUrl.toString())

      const filesInDraft: FilesInDraft = Object.fromEntries(
        await Promise.all(
          filePaths.map(async (filePath) => {
            const fullPath = path.resolve(dir, filePath)

            // Check if it's a media file
            const isMediaFile = MEDIA_EXTENSIONS.some((ext) => filePath.toLowerCase().endsWith(`.${ext}`))

            // For media files, use empty content (they're handled separately)
            const content = isMediaFile ? '' : await fs.promises.readFile(fullPath, 'utf-8')

            const githubPath = path.posix.join(githubFolder, path.posix.relative(dir, filePath.replace(/\\/g, '/')))
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

      console.log(pc.blue(`Waiting for browser to connect...`))
      ws.on('message', async (message: any) => {
        const string = message.toString()
        const data = safeParseJson(string)
        // send the full state only on first message from the browser
        if (data?.type !== 'ready') return
        console.log(pc.green(`Browser connected, showing a preview of your local changes`))
        console.log(pc.gray(`To deploy your changes to the production website simply push the changes on GitHub`))
        console.log(pc.gray(`Holocron will detect the updates and deploy a new version of the site`))

        // Send initial files state after browser is connected
        for (const [key, value] of Object.entries(filesInDraft)) {
          // console.log(`sending state to website for file: ${key}`)
          await client.setDocsState({
            state: {
              filesInDraft: { [key]: value },
            },
          })
        }
      })

      // Watch for file changes and additions
      const handleFileUpdate = async (filePath: string, revalidate: boolean) => {
        const fullPath = path.resolve(dir, filePath)

        // Check if it's a media file
        const isMediaFile = MEDIA_EXTENSIONS.some((ext) => filePath.toLowerCase().endsWith(`.${ext}`))

        // For media files, use empty content (they're handled separately)
        const content = isMediaFile ? '' : await fs.promises.readFile(fullPath, 'utf-8')
        const githubPath = path.posix.join(githubFolder, path.posix.relative(dir, filePath.replace(/\\/g, '/')))

        // Update the local filesInDraft
        filesInDraft[githubPath] = {
          content,
          githubPath,
        }

        // Send only the updated file through the tunnel to all browsers
        const updatedFile = { [githubPath]: filesInDraft[githubPath] }
        console.log(pc.gray(`Sending websocket update for ${githubPath}`))
        return client.setDocsState({
          state: {
            filesInDraft: updatedFile,
          },
          revalidate,
        }).catch((e) => console.error)
      }

      watcher.on('add', (x) => handleFileUpdate(x, true))
      watcher.on('change', (x) => handleFileUpdate(x, false))

      watcher.on('unlink', (filePath) => {
        const githubPath = path.posix.join(githubFolder, path.posix.relative(dir, filePath.replace(/\\/g, '/')))
        // Handle file deletion
        if (filesInDraft[githubPath]) {
          delete filesInDraft[githubPath]

          // Send null value to signal file deletion
          const deletedFile: FilesInDraft = {
            [githubPath]: {
              content: null,
              githubPath,
              deletedLines: 1,
            },
          }
          console.log(pc.gray(`Sending websocket message for deleted file`))
          client.setDocsState({
            state: {
              filesInDraft: deletedFile,
            },
            // when a page is removed we run the server loader. this way we redirect to existing page if we are currently in the deleted page.
            revalidate: true,
          }).catch((e) => console.error)
        }
      })
    } catch (error) {
      console.error(pc.red(error))

      throw error
    }
  })

cli
  .command('sync', 'Sync current branch with GitHub')
  .option('--force', 'Force sync even with uncommitted changes or unpushed commits')
  .action(async (options) => {
    try {
      const config = getUserConfig()

      if (!config || !config.apiKey) {
        console.error(pc.red('You need to be logged in to sync a project.'))
        console.error(pc.cyan('Please run: holocron login'))
        process.exit(1)
      }

      // Get current git branch
      const gitBranch = await getCurrentGitBranch()
      if (!gitBranch) {
        console.error(pc.red('Error: Cannot determine current git branch'))
        console.error(pc.yellow('Make sure you are in a git repository with a valid branch'))
        process.exit(1)
      }

      // Check git status using improved function
      const gitStatus = checkGitStatus()

      if (gitStatus.error) {
        console.error(pc.red('Error checking git status: ' + gitStatus.error))
        process.exit(1)
      }

      if (!options.force && gitStatus.hasUncommittedChanges) {
        console.error(pc.red('Error: You have uncommitted changes'))
        console.error(pc.yellow('The sync command only syncs files that are already pushed to GitHub'))
        console.error(pc.yellow('Please commit and push your changes first before running sync'))
        console.error(pc.yellow('Or use --force to sync anyway'))
        process.exit(1)
      }

      if (!options.force && gitStatus.hasUnpushedCommits) {
        console.error(pc.red('Error: You have unpushed commits'))
        console.error(pc.yellow('The sync command only syncs files that are already pushed to GitHub'))
        console.error(pc.yellow('Please push your commits first before running sync'))
        console.error(pc.yellow('Or use --force to sync anyway'))
        process.exit(1)
      }

      if (options.force && (gitStatus.hasUncommittedChanges || gitStatus.hasUnpushedCommits)) {
        console.log(pc.yellow('Warning: Force syncing with local changes'))
      }

      // Get GitHub info to validate this is a GitHub repo
      const githubInfo = getGitHubInfo()
      if (!githubInfo) {
        console.error(pc.red('Error: Cannot determine GitHub repository information'))
        console.error(pc.yellow('Make sure you are in a GitHub repository with a valid remote origin'))
        process.exit(1)
      }

      // Read docs json to get siteId
      const docsJson = await readTopLevelDocsJson(process.cwd())
      if (!docsJson?.siteId) {
        console.error(pc.red(`Error: ${DOCS_JSON_BASENAME} not found or missing siteId`))
        console.error(pc.cyan('Run "holocron init" to initialize this project'))
        process.exit(1)
      }

      const siteId = docsJson.siteId

      console.log(pc.blue(`Syncing branch "${gitBranch}" for site ${siteId}...`))

      // Call the sync API
      const { data, error } = await apiClient.api.githubSync.post({
        siteId,
        githubBranch: gitBranch,
      })

      if (error) {
        console.error(pc.red('Sync failed: ' + (error.message || 'Unknown error')))
        process.exit(1)
      }

      if (data?.success) {
        console.log(pc.green('Sync completed successfully!'))
        console.log(pc.gray(`Site ID: ${data.siteId}`))
        console.log(pc.gray(`Branch ID: ${data.branchId}`))
        console.log(pc.gray(`GitHub Branch: ${data.githubBranch}`))
      } else {
        console.error(pc.red('Sync failed: Invalid response from server'))
        process.exit(1)
      }
    } catch (error) {
      console.error(pc.red('Error during sync: ' + (error.message || error)))
      process.exit(1)
    }
  })

cli
  .command('delete', 'Delete the current holocron website')
  .option('--confirm', 'Skip confirmation prompt')
  .action(async (options) => {
    try {
      const config = getUserConfig()

      if (!config || !config.apiKey) {
        console.error(pc.red('You need to be logged in to delete a project.'))
        console.error(pc.cyan('Please run: holocron login'))
        process.exit(1)
      }

      // Read docs json to get siteId
      const docsJson = await readTopLevelDocsJson(process.cwd())
      if (!docsJson?.siteId) {
        console.error(pc.red(`Error: ${DOCS_JSON_BASENAME} not found or missing siteId`))
        console.error(pc.cyan('Run "holocron init" to initialize this project'))
        process.exit(1)
      }

      const siteId = docsJson.siteId
      const siteName = docsJson.name || 'Unknown Site'

      // Confirmation prompt unless --confirm flag is used
      if (!options.confirm) {
        if (!isTTY) {
          console.error(pc.red('Error: --confirm is required in non-interactive environments'))
          console.error(pc.cyan('Usage: holocron delete --confirm'))
          process.exit(1)
        }

        const response = await prompts({
          type: 'confirm',
          name: 'confirmDelete',
          message: `Are you sure you want to delete the website "${siteName}" (${siteId})? This action cannot be undone.`,
          initial: false,
        })

        if (!response.confirmDelete) {
          console.log(pc.yellow('Delete operation cancelled.'))
          process.exit(0)
        }
      }

      console.log(pc.blue(`Deleting website "${siteName}" (${siteId})...`))

      // Call the delete API
      const { data, error } = await apiClient.api.deleteWebsite.post({
        siteId,
      })

      if (error) {
        console.error(pc.red('Delete failed: ' + (error.message || 'Unknown error')))
        process.exit(1)
      }

      if (data?.success) {
        console.log(pc.green('Website deleted successfully!'))
        console.log(pc.gray(`Site "${siteName}" has been permanently removed.`))

        // Optionally remove the docs json file
        const holocronJsonPath = path.resolve(DOCS_JSON_BASENAME)
        if (fs.existsSync(holocronJsonPath)) {
          fs.unlinkSync(holocronJsonPath)
          console.log(pc.gray(`Local ${DOCS_JSON_BASENAME} file removed.`))
        }
      } else {
        console.error(pc.red('Delete failed: Invalid response from server'))
        process.exit(1)
      }
    } catch (error) {
      console.error(pc.red('Error during delete: ' + (error.message || error)))
      process.exit(1)
    }
  })

cli.command('logout', 'Delete user token and config').action(async () => {
  try {
    if (fs.existsSync(configPath)) {
      fs.unlinkSync(configPath)
      console.log(pc.green('Logged out successfully!'))
      console.log(pc.gray(`Config file removed: ${configPath}`))
    } else {
      console.log(pc.yellow('Already logged out.'))
    }
  } catch (error) {
    console.error(pc.red('Error during logout: ' + ((error as Error).message || error)))
    process.exit(1)
  }
})
