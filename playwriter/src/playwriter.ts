// Removed Playwright import - launching Chrome directly
import { spawn } from 'child_process'
import { createRequire } from 'module'
import os from 'node:os'
import fs from 'node:fs'
import path from 'node:path'
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

    throw new Error(
        'Could not find Chrome executable. Please install Google Chrome.',
    )
}

export async function startPlaywriter(emailProfile?: string) {
    const cdpPort = 9922

    try {
        // Find Chrome executable
        const executablePath = findChromeExecutablePath()
        console.error(`Found Chrome at: ${executablePath}`)

        // Get available Chrome profiles
        const profiles = getAllProfiles()
        let selectedProfilePath: string

        // If no emailProfile provided, we can't proceed
        if (!emailProfile) {
            throw new Error('Email profile is required to start Chrome')
        }

        // Find the profile matching the email
        const matchingProfile = profiles.find((p) => p.email === emailProfile)

        if (!matchingProfile) {
            if (profiles.length === 0) {
                // Create a temporary profile directory for automation
                const tempDir = path.join(
                    os.tmpdir(),
                    'playwriter-automation-profile',
                )
                if (!fs.existsSync(tempDir)) {
                    fs.mkdirSync(tempDir, { recursive: true })
                }
                selectedProfilePath = tempDir
                console.warn(
                    `No Chrome profiles found. Using temporary profile at: ${tempDir}`,
                )
            } else {
                throw new Error(
                    `No Chrome profile found for email: ${emailProfile}. Available emails: ${profiles.map((p) => p.email).join(', ')}`,
                )
            }
        } else {
            selectedProfilePath = matchingProfile.path
            console.error(
                `Using profile for ${emailProfile}: ${selectedProfilePath}`,
            )
        }

        // Start browser with CDP enabled
        console.error(`Starting Chrome with CDP on port ${cdpPort}...`)

        // Get the Chrome user data directory and profile folder
        const chromeUserDataDir = path.dirname(selectedProfilePath)
        const profileFolder = path.basename(selectedProfilePath)

        console.error({ chromeUserDataDir })
        // Build Chrome arguments
        const chromeArgs = [
            `--remote-debugging-port=${cdpPort}`,
            '--window-position=-32000,-32000', // Position window off-screen
            '--window-size=1280,720',
            '--disable-backgrounding-occluded-windows', // Prevents Chrome from throttling/suspending hidden tabs
            '--disable-gpu', // Disable GPU acceleration for better compatibility
            // `--user-data-dir`, // Chrome's main user data directory
            // chromeUserDataDir,
            '--no-first-run', // Skip first-run dialogs
            '--disable-default-apps', // Disable default app installation
            '--disable-translate', // Disable translate prompts
            '--disable-features=TranslateUI', // Disable translate UI
            '--no-default-browser-check', // Don't check if Chrome is default browser
            '--disable-session-crashed-bubble', // Disable session restore bubble
            '--disable-infobars', // Disable info bars
            '--automation', // Enable automation mode
            '--disable-features=DevToolsDebuggingRestrictions',
        ]

        if (profileFolder !== 'Default') {
            chromeArgs.push(`--profile-directory=${profileFolder}`)
        }

        // Launch Chrome directly as a subprocess
        console.error('Launching Chrome with args:', chromeArgs)
        const chromeProcess = spawn(executablePath, chromeArgs, {
            detached: false,
            stdio: 'inherit', // Print Chrome logs to console
        })

        chromeProcess.on('error', (error) => {
            console.error('Failed to start Chrome:', error)
            throw error
        })

        // Give Chrome a moment to start up and open the debugging port
        await new Promise((resolve) => setTimeout(resolve, 2000))

        // On macOS, minimize only this Chrome window using its PID
        if (os.platform() === 'darwin' && chromeProcess.pid) {
            try {
                // Minimize the specific Chrome window using its process ID
                // This keeps it running but out of the way
                const minimizeScript = spawn('osascript', [
                    '-e',
                    `tell application "System Events"`,
                    '-e',
                    `tell (first process whose unix id is ${chromeProcess.pid})`,
                    '-e',
                    `try`,
                    '-e',
                    `set value of attribute "AXMinimized" of window 1 to true`,
                    '-e',
                    `end try`,
                    '-e',
                    `end tell`,
                    '-e',
                    `end tell`,
                ])

                minimizeScript.on('error', () => {
                    // Silently ignore - window might already be hidden
                })
            } catch (e) {
                // Ignore errors, this is best-effort
            }
        }

        console.error(
            `Chrome started with CDP on port ${cdpPort} (window is hidden off-screen)`,
        )
        return { cdpPort, chromeProcess }

        // // Resolve @playwright/mcp package.json path
        // const require = createRequire(import.meta.url)
        // const mcpPackageJsonPath = require.resolve('@playwright/mcp/package.json')
        // const mcpCliPath = path.resolve(mcpPackageJsonPath, '..', 'cli.js')
        // console.log(`Found MCP CLI at: ${mcpCliPath}`)

        // // Start MCP CLI process
        // console.log('Starting MCP CLI...')
        // const mcpProcess = spawn('node', [
        //     mcpCliPath,
        //     '--cdp-endpoint',
        //     `http://localhost:${cdpPort}`
        // ], {
        //     stdio: 'inherit', // Forward all logs
        // })

        // mcpProcess.on('error', (error) => {
        //     console.error('Failed to start MCP CLI:', error)
        // })

        // mcpProcess.on('exit', (code, signal) => {
        //     console.log(`MCP CLI exited with code ${code} and signal ${signal}`)
        // })

        // // Handle cleanup
        // const cleanup = async () => {
        //     console.log('Shutting down...')
        //     mcpProcess.kill()
        //     chromeProcess.kill()
        //     process.exit(0)
        // }

        // process.on('SIGINT', cleanup)
        // process.on('SIGTERM', cleanup)

        // return { chromeProcess, mcpProcess }
    } catch (error) {
        console.error('Failed to start Playwriter:', error)
        throw error
    }
}
