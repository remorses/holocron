import { DatasetsInterface } from './types.js'
import { FileSchema } from './types.js'
import z from 'zod'

export async function importFromGitHub({
    dataset,
    datasetId,
    owner,
    repo,
    branch = 'main',
    path = '',
}: {
    dataset: DatasetsInterface
    datasetId: string
    owner: string
    repo: string
    branch?: string
    path?: string
}): Promise<{ filesImported: number; totalSizeBytes: number }> {
    // Construct the GitHub API URL for the tar archive
    const tarUrl = `https://github.com/${owner}/${repo}/archive/${branch}.tar.gz`
    
    // Import processTarArchive to handle the tar file
    const { processTarArchive } = await import('./processTarArchive.js')
    
    // Process the tar archive
    return processTarArchive({
        url: tarUrl,
        datasetId,
        path: path ? `${repo}-${branch}/${path}` : `${repo}-${branch}`,
        metadata: {
            source: 'github',
            owner,
            repo,
            branch,
            importedAt: new Date().toISOString(),
        },
        stub: dataset,
    })
}