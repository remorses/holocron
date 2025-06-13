import { Sema } from 'async-sema'
import { prisma } from 'db'
import { App, Octokit } from 'octokit'
import { AppError, notifyError } from 'website/src/lib/errors'
import { isTruthy } from 'website/src/lib/utils'
import { env } from './env'

type OctokitRest = Octokit['rest']

// data passed back to framer after login, to tell it what org to use
export type GithubLoginRequestData = {
    githubAccountLogin: string
}

export function getGithubApp(): App {
    const app = new App({
        appId: env.GITHUB_APP_ID!,
        privateKey: env.GITHUB_APP_PRIVATE_KEY!,

        oauth: {
            clientId: env.GITHUB_CLIENT_ID!,
            clientSecret: env.GITHUB_CLIENT_SECRET!,
            allowSignup: true,
        },

        webhooks: {
            secret: env.SECRET!,
        },
    })
    return app
}

export async function checkGitHubIsInstalled({ installationId }) {
    try {
        const octokit = await getGithubApp()

        const installation = await octokit.octokit.rest.apps.getInstallation({
            installation_id: installationId,
        })
        return !!installation.data.id
    } catch (e) {
        if (e.status === 404) {
            await prisma.githubInstallation.updateMany({
                where: {
                    installationId: installationId,
                    // appId: env.GITHUB_APP_ID,
                },
                data: {
                    status: 'suspended',
                },
            })
            return false
        }
        throw e
    }
}

export async function getOctokit({ installationId }): Promise<Octokit> {
    installationId = Number(installationId)
    // const cached = installationsCache.get(installationId)
    // if (cached) {
    //     return cached
    // }
    const app = getGithubApp()

    // https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/authenticating-as-a-github-app-installation
    const octokit = await app.getInstallationOctokit(installationId)
    // .catch(handleOctokitError(installationId))
    // installationsCache.set(installationId, octokit)
    return octokit
}
export async function getRepoFiles({
    branch,
    owner,
    repo,
    octokit,
    commitSha,
    fetchBlob,
    baseUrl,
    signal,
}: {
    octokit: OctokitRest
    owner: string
    repo: string
    branch: string
    commitSha?: string
    baseUrl?: string
    fetchBlob: (p: {
        path?: string
        sha?: string
        type?: string
        mode?: string
    }) => boolean
    signal?: AbortSignal
}) {
    if (!commitSha) {
        console.log(`getting current commit for ${branch}`)
        const { data: commitData } = await octokit.git.getRef({
            owner,
            repo,
            ref: `heads/${branch}`,
            request: { signal },
        })
        commitSha = commitData.object.sha
    }
    console.log(`getting github tree ${commitSha}`)
    const tree = await octokit.git.getTree({
        owner,
        repo,
        tree_sha: commitSha,
        recursive: 'true',
        baseUrl,
        request: { signal },
    })

    const files = tree.data.tree.filter((file) => {
        if (file.type !== 'blob') {
            return false
        }
        // if (filter) {
        //     return filter(file)
        // }
        return true
    })
    console.log(`found ${files.length} files in repo ${owner}/${repo}`)
    const sema = new Sema(10)
    const downloadedFiles = await Promise.all(
        files.map(async (file) => {
            try {
                await sema.acquire()
                let pathWithFrontSlash = addInitialSlashToPath(file.path || '')
                if (!pathWithFrontSlash) {
                    return
                }
                // console.log(`getting blob for ${file.path}`)
                if (!fetchBlob(file)) {
                    return {
                        pathWithFrontSlash,
                        githubPath: file.path,
                        size: file.size,
                        sha: file.sha,
                        type: file.type,
                    }
                }
                console.log(
                    `fetching blog for ${file.path} in ${owner}/${repo}`,
                )
                const [{ data }] = await Promise.all([
                    octokit.git.getBlob({
                        owner,
                        repo,
                        file_sha: file.sha!,
                        baseUrl,
                        request: { signal },
                    }),
                    // octokit.repos.getCommit({
                    //     owner,
                    //     repo,
                    //     ref: file.sha!,
                    // }),
                ])

                const contents = Buffer.from(data.content, 'base64').toString(
                    'utf-8',
                )

                return {
                    pathWithFrontSlash: pathWithFrontSlash,
                    content: contents! || '',
                    size: file.size,
                    sha: file.sha,
                    githubPath: file.path,
                }
            } finally {
                sema.release()
            }
        }),
    )
    return downloadedFiles.filter(isTruthy)
}

export function isMarkdown(p: string) {
    return p.endsWith('.md') || p.endsWith('.markdown') || p.endsWith('.mdx')
}


export async function upsertGithubFile({
    octokit,
    owner,
    repo,
    githubBranch,
    githubPath,
    code,
}: {
    octokit: Octokit
    owner: string
    repo: string
    githubBranch: string
    githubPath: string
    code: string
}): Promise<void> {
    const githubFile = await getGithubFile({
        githubBranch: githubBranch!,
        githubPath,
        owner,
        repo,
        octokit: octokit.rest,
    })

    const { content: pastContent, sha } = githubFile || {
        content: '',
        sha: undefined,
    }
    if (pastContent === code) {
        console.log(`Ignoring update for ${githubPath}, same content`)
        return
    }
    const base64New = Buffer.from(code).toString('base64')
    const { data } = await octokit.rest.repos
        .createOrUpdateFileContents({
            owner: owner,
            repo: repo,
            path: githubPath,
            message: getCommitMessage({
                filePaths: [githubPath],
            }),
            content: base64New,
            sha,
            branch: githubBranch,

            committer: committer,
        })
        .catch((e) => {
            notifyError(
                e,
                `Could not update github file ${owner}/${repo}/${githubBranch}, path ${githubPath} `,
            )
            return { data: null }
        })
    if (!data) {
        return
    }
    // https://github.com/org-for-testing-knowledg/test-uploads/commit/dc322ec5fa21803eb8108a5ef9bc10b58f087d8f
    let url = `https://github.com/${owner}/${repo}/commit/${data.commit.sha}`
}

export function addInitialSlashToPath(path?: string) {
    if (!path) {
        return ''
    }
    if (!path.startsWith('/')) {
        path = `/${path}`
    }

    return path
}

// Credit to https://dev.to/lucis/how-to-push-files-programatically-to-a-repository-using-octokit-with-typescript-1nj0

export async function doesRepoExist({
    octokit,
    owner,
    repo,
}: {
    octokit: OctokitRest
    owner: string
    repo: string
}) {
    try {
        const res = await octokit.repos.get({
            owner,
            repo,
        })
        console.log(`Repository ${owner}/${repo} exists.`)
        return res.data
    } catch (error) {
        if (error.status === 404) {
            return null
        } else {
            throw new Error(
                `Error checking repository ${owner}/${repo}: ${error.message}`,
            )
        }
    }
}

export async function createNewRepo({
    // branch,
    files,
    repo,
    isGithubOrg,
    owner,
    octokit,
    privateRepo = true,
    oauthToken,
}: {
    owner
    isGithubOrg
    files: { filePath: string; content: string }[]
    repo: string
    octokit: Octokit['rest']
    privateRepo: boolean
    oauthToken?: string
}) {
    files = files.filter((x) => {
        return true
        // return githubPathToPageSlug(x.filePath) !== TUTORIAL_PAGE_SLUG
    })
    // const owner = github.accountLogin
    // const isGithubOrg = github.accountType === 'ORGANIZATION'
    // const installationId = github.installationId
    // const octokit = (await getOctokit({ installationId })).rest

    console.log(`uploading files to github ${owner}/${repo}`)
    console.log(`creating repo for ${isGithubOrg ? 'org' : 'user'} ${owner}`)
    const create = async (
        args: Parameters<typeof octokit.repos.createInOrg>[0],
    ) => {
        if (isGithubOrg) {
            return await octokit.repos.createInOrg(args)
        } else {
            if (!oauthToken) {
                throw new AppError(
                    `Cannot create repo for user without Github token, reconnect Github`,
                )
            }
            // const app = getGithubApp()
            // const res = await app.oauth.refreshToken({
            //     refreshToken: github.oauthRefreshToken,
            // })
            // const token = res.authentication.token
            const octokit = new Octokit({
                auth: oauthToken,
            }).rest

            return await octokit.repos.createForAuthenticatedUser(args)
        }
    }
    const { data: repoResult } = await create({
        org: owner,
        name: repo,
        private: privateRepo,
        description: `Repository created using Unframer`,
        has_wiki: false,
        auto_init: true,

    }).catch((e) => {
        if (e.status === 422) {
            throw new AppError(`Repository name already used`)
        }
        throw e
    })
    const branch = repoResult.default_branch
    const { data: refData } = await octokit.git.getRef({
        owner: owner,
        repo,
        ref: `heads/${branch}`,
    })
    const commitSha = refData.object.sha
    console.log(`getting commit ${commitSha}`)
    const { data: commitData } = await octokit.git.getCommit({
        owner: owner,
        repo,
        commit_sha: commitSha,
    })
    const treeSha = commitData.tree.sha
    // const baseBranchRef = await octokit.git.getRef({
    //     owner,
    //     repo,
    //     ref: `heads/${repoResult.default_branch}`,
    // })
    // await octokit.git.createRef({
    //     owner,
    //     repo,
    //     ref: `refs/heads/${branch}`,
    //     sha: baseBranchRef.data.object.sha,
    // })
    if (!files.length) {
        return
    }
    console.log('getting blobs')
    const withBlobs = await Promise.all(
        files.map(async (x) => {
            const encoding = 'utf-8'
            const blobData = await octokit.git.createBlob({
                owner: owner,
                repo,
                content: x.content,
                encoding,
            })
            return {
                ...x,
                blobSha: blobData.data.sha,
                blob: blobData.data,
            }
        }),
    )

    // Create a new tree from all of the files, so that a new commit can be made from it
    const newTree = await createNewTree({
        octokit,
        owner,
        repo,
        create: withBlobs,
        parentTreeSha: treeSha,
    })

    // Create the new commit with all of the file changes

    console.log('creating commit')
    const { data: newCommit } = await octokit.git.createCommit({
        owner: owner,
        repo,
        message: `Holocron Initial Commit`,
        tree: newTree.sha,

        committer: committer,
        parents: [commitSha],
    })

    try {
        console.log('pushing commit')
        // This pushes the commit to the main branch in GitHub
        await octokit.git.updateRef({
            owner: owner,
            repo,
            ref: `heads/${branch}`,
            sha: newCommit.sha,
        })
    } catch (err) {
        throw err
    }
    return { branch, githubRepoId: String(repoResult.id) }
}

export const createNewTree = async ({
    create,
    octokit,
    owner,
    parentTreeSha,
    repo,
}: {
    octokit: OctokitRest
    owner: string
    repo: string
    create: { filePath: string; blobSha: string }[]
    parentTreeSha: string
}) => {
    if (!parentTreeSha) {
        throw new AppError(`No parent tree sha`)
    }

    const tree = create.map(({ blobSha, filePath }, index) => ({
        path: filePath,
        mode: `100644`,
        type: `blob`,
        sha: blobSha as string | null,
    })) as any[]

    console.log('creating new tree')
    const { data } = await octokit.git.createTree({
        owner,
        repo,
        tree,
        base_tree: parentTreeSha,
    })
    return data
}

export async function pushChangesToNewBranch({
    files,
    owner,
    repo,
    branch,
    octokit,
    baseBranch,
}: {
    octokit: OctokitRest
    files: { filePath: string; content: string }[]
    owner: string
    repo: string
    branch: string
    baseBranch: string
}) {
    const { data: refData } = await octokit.git.getRef({
        owner,
        repo,
        ref: `heads/${branch}`,
    })
    let commitSha = refData.object.sha
    console.log(`getting commit ${commitSha}`)
    const { data: commitData } = await octokit.git.getCommit({
        owner: owner,
        repo,
        commit_sha: commitSha,
    })
    const treeSha = commitData.tree.sha

    console.log(
        'creating blobs for',
        files.map((x) => x.filePath),
    )
    const withBlobs = await Promise.all(
        files.map(async (x) => {
            const encoding = 'utf-8'
            const blobData = await octokit.git.createBlob({
                owner,
                repo,
                content: x.content,
                encoding,
            })
            return {
                ...x,
                blobSha: blobData.data.sha,
                blob: blobData.data,
            }
        }),
    )

    const newTree = await createNewTree({
        octokit,
        owner,
        repo,
        create: withBlobs,
        parentTreeSha: treeSha,
    })

    console.log('creating commit')
    const { data: newCommit } = await octokit.git.createCommit({
        owner: owner,
        repo,
        message: getCommitMessage({
            filePaths: files.map((x) => x.filePath),
        }),
        tree: newTree.sha,

        committer: committer,
        parents: [commitSha],
    })

    // creates the branch
    await octokit.git.createRef({
        owner: owner,
        repo,
        ref: `refs/heads/${branch}`,
        sha: newCommit.sha,
    })
    return {}
}

export const committer = {
    name: 'Unframer',
    email: 'info@unframer.co',
}

export function getCommitMessage({ filePaths = [] as string[] }) {
    const files = filePaths
        .map((x) => {
            if (x.startsWith('/')) {
                x = x.slice(1)
            }
            return x
        })
        .map((x) => '`' + x + '`')
        .join(', ')
    const message = `Update ${files}`
    return message
}

export async function getGithubFile({
    octokit,
    owner,
    githubPath,
    repo,
    githubBranch,
    baseUrl,
}: {
    octokit: OctokitRest
    owner: string
    githubPath: string
    repo: string
    githubBranch: string
    baseUrl?: string
}) {
    if (!githubPath) {
        return null
    }
    try {
        const { data } = await octokit.repos.getContent({
            owner,
            repo,
            path: githubPath,
            branch: githubBranch,
            ref: githubBranch,
            baseUrl,
        })
        if ('type' in data && data.type === 'file') {
            let base64 = data.content
            let sha = data.sha
            let content = Buffer.from(base64 || '', 'base64').toString('utf-8')
            return { content, sha }
        }
    } catch (e) {}
    return null
}
type Repo = { owner: string; repo: string; branch: string }
