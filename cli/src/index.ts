import { cac } from 'cac'
import fs from 'fs'
import path from 'path'

import { globby } from 'globby'

export const cli = cac('fumabase')

cli.help()

cli.command('dev', 'Preview your fumabase website')
    .option('--secret <value>', 'Secret key for deployment', {})
    .option('--slug <repo>', 'Repository slug', {})
    .option('--dir <directory>', 'Directory to deploy', { default: './dist' })
    .action(async function main(options) {
        // console.log({ options })
        const { slug, dir, secret } = options
        if (!slug) {
            console.error('No repository slug provided')
            return
        }

        if (!secret) {
            console.error('No secret key provided')
            return
        }
        try {
            const filePaths = await globby(
                ['**/*.md', '**/*.mdx', '**/meta.json', '**/docs.json'],
                {
                    cwd: dir,
                    onlyFiles: true,
                },
            )
            if (!filePaths.length) {
                console.error(`No files to upload inside ${dir}`)
                return
            }
            console.log(`uploading ${filePaths.length} files`)
            // Upload the website
            const { data, error } =
                await unframerBucketServerSdk.api.uploadFiles.post({
                    files: await Promise.all(
                        filePaths.map(async (filePath) => {
                            const fullPath = path.resolve(dir, filePath)
                            const contents = await fs.promises.readFile(
                                fullPath,
                                'utf-8',
                            )

                            return {
                                path: filePath,
                                contents,
                            }
                        }),
                    ),
                    basePath: slug,
                    secret,
                })
            if (error) throw error

            console.log(`🚀 Website deployed at ${data.url}`)
        } catch (error) {
            console.error(error)

            throw error
        }
    })
