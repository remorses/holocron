import { chromium } from 'playwright'
import { spawn } from 'child_process'
import { createRequire } from 'module'
import os from 'node:os'
import fs from 'node:fs'
import path from 'node:path'
import prompts from 'prompts'
import { getAllProfiles } from './profiles.js'

// Find Chrome executable path based on OS
function findChromeExecutablePath(): string {
    const osPlatform = os.platform()

    const paths: string[] = (() => {
        if (osPlatform === 'darwin') {
            return [
                '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
                '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
                '~/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
            ]
        }
        if (osPlatform === 'win32') {
            return [
                'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
                'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
                `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
                `${process.env.PROGRAMFILES}\\Google\\Chrome\\Application\\chrome.exe`,
                `${process.env['PROGRAMFILES(X86)']}\\Google\\Chrome\\Application\\chrome.exe`,
            ].filter(Boolean)
        }
        // Linux
        return [
            '/usr/bin/google-chrome',
            '/usr/bin/google-chrome-stable',
            '/usr/bin/chromium',
            '/usr/bin/chromium-browser',
            '/snap/bin/chromium',
        ]
    })()

    for (const path of paths) {
        const resolvedPath = path.startsWith('~')
            ? path.replace('~', process.env.HOME || '')
            : path
        if (fs.existsSync(resolvedPath)) {
            return resolvedPath
        }
    }

    throw new Error('Could not find Chrome executable. Please install Google Chrome.')
}

export async function startPlaywriter() {
    const cdpPort = 9922

    try {
        // Find Chrome executable
        const executablePath = findChromeExecutablePath()
        console.log(`Found Chrome at: ${executablePath}`)

        // Get available Chrome profiles
        const profiles = getAllProfiles()
        let selectedProfilePath: string

        if (profiles.length === 0) {
            // Create a temporary profile directory for automation
            const tempDir = path.join(os.tmpdir(), 'playwriter-automation-profile')
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true })
            }
            selectedProfilePath = tempDir
            console.warn(`No Chrome profiles found. Using temporary profile at: ${tempDir}`)
        } else {
            console.log('\n⚠️  Please select a Chrome profile WITHOUT sensitive data:')
            console.log('(Use a test profile or create a new one for automation)\n')

            const response = await prompts({
                type: 'select',
                name: 'profile',
                message: 'Select Chrome profile',
                choices: profiles.map(profile => ({
                    title: profile.displayName,
                    value: profile.path,
                    description: profile.path,
                })),
            })

            if (!response.profile) {
                console.log('No profile selected. Exiting.')
                process.exit(0)
            }

            selectedProfilePath = response.profile
            console.log(`\nUsing profile: ${selectedProfilePath}`)
        }

        // Start browser with CDP enabled
        console.log(`Starting Chrome with CDP on port ${cdpPort}...`)

        // Get the Chrome user data directory and profile folder
        const chromeUserDataDir = path.dirname(selectedProfilePath)
        const profileFolder = path.basename(selectedProfilePath)
        
        // Common args for hiding the window and keeping pages active
        const commonArgs = [
            `--remote-debugging-port=${cdpPort}`,
            '--window-position=-32000,-32000',
            '--window-size=1280,720',
            '--disable-backgrounding-occluded-windows', // Prevents Chrome from throttling/suspending hidden tabs
            '--disable-gpu', // Disable GPU acceleration for better compatibility
            `--user-data-dir=${chromeUserDataDir}`, // Point to Chrome's main user data directory
        ]
        
        // Add profile-directory for non-default profiles
        if (profileFolder !== 'Default') {
            commonArgs.push(`--profile-directory=${profileFolder}`)
        }

        // Use regular launch with native Chrome profile loading
        // This ensures all cookies, extensions, and settings are loaded
        const browser = await chromium.launch({
            executablePath,
            args: commonArgs,
            headless: false,
        })

        console.log(`Chrome started with CDP on port ${cdpPort} (window is hidden off-screen)`)


        // Resolve @playwright/mcp package.json path
        const require = createRequire(import.meta.url)
        const mcpPackageJsonPath = require.resolve('@playwright/mcp/package.json')
        const mcpCliPath = path.resolve(mcpPackageJsonPath, '..', 'cli.js')
        console.log(`Found MCP CLI at: ${mcpCliPath}`)

        // Start MCP CLI process
        console.log('Starting MCP CLI...')
        const mcpProcess = spawn('node', [
            mcpCliPath,
            '--cdp-endpoint',
            `http://localhost:${cdpPort}`
        ], {
            stdio: 'inherit', // Forward all logs
        })

        mcpProcess.on('error', (error) => {
            console.error('Failed to start MCP CLI:', error)
        })

        mcpProcess.on('exit', (code, signal) => {
            console.log(`MCP CLI exited with code ${code} and signal ${signal}`)
        })

        // Handle cleanup
        const cleanup = async () => {
            console.log('Shutting down...')
            mcpProcess.kill()
            await browser.close()
            process.exit(0)
        }

        process.on('SIGINT', cleanup)
        process.on('SIGTERM', cleanup)

        return { browser, mcpProcess }
    } catch (error) {
        console.error('Failed to start Playwriter:', error)
        throw error
    }
}

startPlaywriter().catch(console.error)
