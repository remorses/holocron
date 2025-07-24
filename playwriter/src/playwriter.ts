import { chromium } from 'playwright'
import { spawn } from 'child_process'
import { createRequire } from 'module'
import os from 'node:os'
import fs from 'node:fs'
import path from 'node:path'
import prompts from 'prompts'
import { getAllProfiles } from './profiles'

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
        let selectedProfilePath: string | undefined
        
        if (profiles.length === 0) {
            console.warn('No Chrome profiles found. Starting with default profile.')
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
        
        let browser
        let context
        if (selectedProfilePath) {
            // Use launchPersistentContext when user data dir is specified
            context = await chromium.launchPersistentContext(selectedProfilePath, {
                executablePath,
                args: [`--remote-debugging-port=${cdpPort}`],
                headless: false,
            })
            browser = context
        } else {
            // Use regular launch when no profile is selected
            browser = await chromium.launch({
                executablePath,
                args: [`--remote-debugging-port=${cdpPort}`],
                headless: false,
            })
        }

        console.log(`Chrome started with CDP on port ${cdpPort}`)

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
        process.on('SIGINT', async () => {
            console.log('Shutting down...')
            mcpProcess.kill()
            await browser.close()
            process.exit(0)
        })

        process.on('SIGTERM', async () => {
            console.log('Shutting down...')
            mcpProcess.kill()
            await browser.close()
            process.exit(0)
        })

        return { browser, mcpProcess }
    } catch (error) {
        console.error('Failed to start Playwriter:', error)
        throw error
    }
}

startPlaywriter().catch(console.error)
