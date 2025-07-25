import fs from 'node:fs'
import os from 'node:os'

// Function to get the browser executable path
// Can be overridden by environment variable PLAYWRITER_BROWSER_PATH
export function getBrowserExecutablePath(): string {
    // Check environment variable first
    const envPath = process.env.PLAYWRITER_BROWSER_PATH
    if (envPath && fs.existsSync(envPath)) {
        return envPath
    }
    
    // Check for Ghost Browser on macOS
    const ghostBrowserPath = '/Applications/Ghost Browser.app/Contents/MacOS/Ghost Browser'
    if (fs.existsSync(ghostBrowserPath)) {
        return ghostBrowserPath
    }
    
    // Fall back to finding Chrome
    return findChromeExecutablePath()
}

// Original Chrome finding logic
function findChromeExecutablePath(): string {
    const osPlatform = os.platform()
    const paths = (() => {
        if (osPlatform === 'darwin') {
            return [
                '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
                '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
                '/Applications/Chromium.app/Contents/MacOS/Chromium',
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
        'Could not find Chrome executable. Please install Google Chrome or set PLAYWRITER_BROWSER_PATH environment variable.',
    )
}