import { cac } from 'cac'
import os from 'os'
import { DocsJsonType } from 'docs-website/src/lib/docs-json.js'

import fs from 'fs'
import path from 'path'

import { globby } from 'globby'
import { createApiClient } from './generated/spiceflow-client.js'
import { execSync } from 'child_process'

export async function readTopLevelDocsJson() {
    const docsJsonPath = path.resolve(process.cwd(), 'docs.json')
    if (!fs.existsSync(docsJsonPath)) {
        return
    }
    const content = await fs.promises.readFile(docsJsonPath, 'utf-8')
    try {
        return JSON.parse(content) as DocsJsonType
    } catch (e) {
        console.error('Error parsing docs.json:', e.message)
        return
    }
}

export async function getCurrentGitBranch(): Promise<string | undefined> {
    try {
        const branch = execSync('git rev-parse --abbrev-ref HEAD')
            .toString()
            .trim()
        return branch
    } catch (e) {
        console.error('Could not detect git branch:', e.message)
        return undefined
    }
}

export function openUrlInBrowser(url: string) {
    let command: string

    switch (os.platform()) {
        case 'darwin':
            command = `open "${url}"`
            break
        case 'win32':
            command = `start "" "${url}"`
            break
        default:
            // linux, unix, etc.
            command = `xdg-open "${url}"`
            break
    }

    try {
        execSync(command, { stdio: 'ignore' })
    } catch (error) {
        console.error('Failed to open URL in browser:', error)
    }
}
