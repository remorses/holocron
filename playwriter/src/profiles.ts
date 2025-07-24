import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

/** Resolve Chrome's "User Data" root on the current OS. */
export function getChromeUserDataDir(): string {
    const home = os.homedir()
    switch (os.platform()) {
        case 'win32':
            return path.join(
                process.env.LOCALAPPDATA!,
                'Google',
                'Chrome',
                'User Data',
            )
        case 'darwin':
            return path.join(
                home,
                'Library',
                'Application Support',
                'Google',
                'Chrome',
            )
        default: // linux, freebsd, …
            return path.join(home, '.config', 'google-chrome')
    }
}

/** Read and parse the top-level "Local State" JSON once. */
export function readLocalState(): any {
    try {
        const dir = getChromeUserDataDir()
        const localStatePath = path.join(dir, 'Local State')
        
        if (!fs.existsSync(localStatePath)) {
            console.warn(`Chrome Local State file not found at: ${localStatePath}`)
            return {}
        }
        
        const raw = fs.readFileSync(localStatePath, 'utf8')
        return JSON.parse(raw)
    } catch (error) {
        console.error('Failed to read Chrome Local State:', error)
        return {}
    }
}

/** Map <profile-folder> → <signed-in email> (empty string if none). */
export function getProfileEmailMap(): Map<string, string> {
    const localState = readLocalState()
    const infoCache = localState.profile?.info_cache ?? {}
    return new Map(
        Object.entries(infoCache).map(([folder, obj]: [string, any]) => [
            folder,
            obj.user_name ?? '',
        ]),
    )
}

/** Return the full path to a profile directory for the given email. */
export function getProfilePathByEmail(email: string): string | null {
    const root = getChromeUserDataDir()
    for (const [folder, userEmail] of getProfileEmailMap()) {
        if (userEmail.toLowerCase() === email.toLowerCase()) {
            return path.join(root, folder) // e.g. "…/User Data/Profile 2"
        }
    }
    return null // not found
}

/** Get all available Chrome profiles with their paths and emails */
export function getAllProfiles(): Array<{
    folder: string
    email: string
    path: string
    displayName: string
}> {
    const root = getChromeUserDataDir()
    const profiles: Array<{
        folder: string
        email: string
        path: string
        displayName: string
    }> = []
    
    for (const [folder, email] of getProfileEmailMap()) {
        profiles.push({
            folder,
            email,
            path: path.join(root, folder),
            displayName: email || `${folder} (no email)`,
        })
    }
    
    // Also include Default profile if it exists
    const defaultPath = path.join(root, 'Default')
    if (fs.existsSync(defaultPath) && !profiles.some(p => p.folder === 'Default')) {
        profiles.unshift({
            folder: 'Default',
            email: '',
            path: defaultPath,
            displayName: 'Default (no email)',
        })
    }
    
    return profiles
}