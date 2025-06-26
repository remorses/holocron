import { Sema } from 'sema4'
import { prisma } from 'db'
import { App, Octokit, RequestError } from 'octokit'
import { AppError, notifyError } from 'website/src/lib/errors'
import { isTruthy } from 'website/src/lib/utils'
import { env } from './env'

type OctokitRest = Octokit['rest']

// data passed back to framer after login, to tell it what org to use
export type GithubLoginRequestData = {
    githubAccountLogin: string
}

const installationsCache = new Map<
    number,
    { octokit: Octokit; timestamp: number }
>()

const repoFilesCache = new Map<string, { data: any; timestamp: number }>()

function handleOctokitError(installationId) {
    return async (e) => {
        // TODO handle This installation has been suspended errors, delete the installation from db

        if (e.message.includes('This installation has been suspended')) {
            console.log(
                `deleting suspended github app for installation ${installationId}`,
            )
            await prisma.githubInstallation.updateMany({
                where: {
                    installationId: installationId,
                },
                data: {
                    status: 'suspended',
                },
            })
            throw e
        }
        throw e
    }
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
    const app = getGithubApp()

    // https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/authenticating-as-a-github-app-installation
    const octokit = await app
        .getInstallationOctokit(installationId)
        .catch(handleOctokitError(installationId))
    // installationsCache.set(installationId, { octokit, timestamp: Date.now() })
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
                let pathWithFrontSlash = addFrontSlashToPath(file.path || '')
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

export const getCurrentCommit = async ({
    octokit,
    owner,
    repo,
    branch,
}: {
    octokit: OctokitRest
    owner: string
    repo: string
    branch: string
}) => {
    console.log(`getting ref ${branch}`)
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
    return {
        commitSha,
        treeSha: commitData.tree.sha,
    }
}

export async function createBranch({
    owner,
    repo,
    octokit,
    branch,
}: {
    octokit: OctokitRest
    owner: string
    repo: string
    branch: string
}) {
    console.log(`getting repo ${repo}`)
    const repoResult = await octokit.repos.get({ owner, repo })
    let base = repoResult.data.default_branch
    console.log(`getting base branch ${base}`)
    const baseBranchRef = await octokit.git.getRef({
        owner,
        repo,
        ref: `heads/${base}`,
    })
    console.log(`creating branch ${branch}`)
    const { data: newRef } = await octokit.git.createRef({
        owner,
        repo,
        ref: `refs/heads/${branch}`,
        sha: baseBranchRef.data.object.sha,
    })

    return newRef
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

export function addFrontSlashToPath(path?: string) {
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

const createTreeWithUpdates = async ({
    create,
    move,
    remove,
    octokit,
    owner,
    parentTreeSha,
    repo,
}: {
    octokit: OctokitRest
    owner: string
    repo: string
    create: { filePath: string; blobSha: string }[]
    move: { filePath: string; oldPath: string; sha: string }[]
    remove: { filePath: string }[]
    parentTreeSha: string
}) => {
    if (!parentTreeSha) {
        throw new AppError(`No parent tree sha`)
    }
    const tree: {
        path: string
        mode: string
        type: 'blob'
        sha?: string | null
    }[] = []
    for (let toCreate of create) {
        tree.push({
            path: toCreate.filePath,
            type: 'blob',
            mode: `100644`,
            sha: toCreate.blobSha,
        })
    }
    for (let toMove of move) {
        tree.push(
            {
                path: toMove.oldPath,
                type: 'blob',
                mode: `100644`,
                sha: null,
            },
            {
                path: toMove.filePath,
                type: 'blob',
                mode: `100644`,
                sha: toMove.sha,
            },
        )
    }
    for (let toRemove of remove) {
        tree.push({
            path: toRemove.filePath,
            type: 'blob',
            mode: `100644`,
            sha: null as any,
        })
    }

    console.log('creating new tree')
    // console.log(tree)
    const { data } = await octokit.git.createTree({
        owner,
        repo,
        tree: tree as any,
        base_tree: parentTreeSha,
    })
    return data
}

export async function changeGithubTree({
    // branch,
    create,
    move,
    remove,
    owner,
    repo,
    branch,
    octokit,
}: {
    octokit: OctokitRest
    create: { filePath: string; content: string }[]
    move: { oldPath: string; filePath: string; sha: string }[]
    remove: { filePath: string }[]
    owner: string
    repo: string
    branch: string
}) {
    console.log(
        `updating tree to github ${owner}/${repo}`,
        // JSON.stringify({ create, move, remove }, null, 2),
    )

    console.log(
        'creating blobs for',
        create.map((x) => x.filePath),
    )
    const [withBlobs, currentCommit] = await Promise.all([
        Promise.all(
            create.map(async (x) => {
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
        ),
        getCurrentCommit({ octokit, owner, repo, branch }),
    ])

    const newTree = await createTreeWithUpdates({
        octokit,
        owner,
        repo,
        create: withBlobs,
        parentTreeSha: currentCommit.treeSha,
        move,
        remove,
    })

    const files = [...create, ...move, ...remove]

    console.log('creating commit')
    const { data: newCommit } = await octokit.git.createCommit({
        owner: owner,
        repo,
        message: getCommitMessage({
            filePaths: files.map((x) => x.filePath),
        }),
        tree: newTree.sha,

        committer: committer,
        parents: [currentCommit.commitSha],
    })

    const {} = await octokit.git.updateRef({
        owner: owner,
        repo,
        ref: `heads/${branch}`,
        sha: newCommit.sha,
    })
    const commitUrl = `https://github.com/${owner}/${repo}/commit/${newCommit.sha}`
    return { branch, parentCommit: currentCommit, commitUrl }
}

async function pushChangesToBranch({
    files,
    owner,
    repo,
    branch,
    baseBranch = 'main',
    octokit,
}) {
    // 1. Get the commit we will build on
    let parentCommitSha, parentTreeSha
    try {
        const { data: ref } = await octokit.git.getRef({
            owner,
            repo,
            ref: `heads/${branch}`,
        }) // branch already exists
        parentCommitSha = ref.object.sha
    } catch (e: any) {
        if (e.status !== 404) throw e // real error
        const { data: baseRef } = await octokit.git.getRef({
            owner,
            repo,
            ref: `heads/${baseBranch}`,
        }) // fall back to base branch
        parentCommitSha = baseRef.object.sha
    }

    const { data: parentCommit } = await octokit.git.getCommit({
        owner,
        repo,
        commit_sha: parentCommitSha,
    })
    parentTreeSha = parentCommit.tree.sha

    // 2. Create blobs → new tree (same as your helper)
    const newTree = await createNewTree({
        octokit,
        owner,
        repo,
        parentTreeSha,
        create: await Promise.all(
            files.map(async (f) => ({
                ...f,
                blobSha: (
                    await octokit.git.createBlob({
                        owner,
                        repo,
                        content: f.content,
                        encoding: 'utf-8',
                    })
                ).data.sha,
            })),
        ),
    })

    // 3. Create commit that points to the new tree
    const { data: newCommit } = await octokit.git.createCommit({
        owner,
        repo,
        message: getCommitMessage({ filePaths: files.map((f) => f.filePath) }),
        tree: newTree.sha,
        parents: [parentCommitSha],
        committer,
    })

    // 4. Move or create the ref
    try {
        await octokit.git.createRef({
            owner,
            repo,
            ref: `refs/heads/${branch}`,
            sha: newCommit.sha,
        }) // succeeds if branch was absent
    } catch (e: any) {
        if (e.status !== 422) throw e // 422 = ref already exists
        await octokit.git.updateRef({
            // fast-forward existing branch
            owner,
            repo,
            ref: `heads/${branch}`,
            sha: newCommit.sha,
            force: false,
        })
    }
}

export const committer = {
    name: 'Fumabase',
    email: 'info@fumabase.com',
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

export async function getGithubImage({ token, path, owner, branch, repo }) {
    const res = await fetch(
        getGithubAssetUrl({
            path,
            owner,
            branch,
            repo,
        }),
        {
            headers: {
                Authorization: `token ${token}`,
            },
        },
    )
    if (!res.ok) {
        throw new AppError(`Could not get github image ${path}`)
    }
    return res
}

export function getGithubAssetUrl({ path = '', owner, branch, repo }) {
    if (!path.startsWith('/')) {
        path = '/' + path
    }
    return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}${path}`
}

async function checkOrCreateFork({
    octokit,
    upstream,
    accountLogin,
}: {
    octokit: Octokit
    upstream: { owner: string; repo: string; branch: string }
    accountLogin: string
}) {
    const autocompleteForks = await octokit.rest.repos.listForks(upstream)

    const existingFork = autocompleteForks.data.find((fork) => {
        return fork.owner.login === accountLogin
    })
    if (existingFork) {
        console.info('A fork of the target repo already exists')
        const forkData = {
            owner: existingFork.owner.login,
            repo: existingFork.name,
        }
        console.log(`merging upstream to fork from ${upstream.branch}`)
        try {
            await octokit.rest.repos.mergeUpstream({
                branch: upstream.branch,
                ...forkData,
                merge_type: 'fast-forward',
            })
        } catch (e) {
            notifyError(e, 'mergeUpstream')
            throw new AppError(
                `Failed syncing your fork ${forkData.owner}/${forkData.repo} with the upstream repo.`,
            )
        }

        return {
            owner: forkData.owner,
            repo: forkData.repo,
        }
    }

    // TODO: race until the repo is created
    const createdFork = await octokit.rest.repos.createFork(upstream)
    console.info(
        `Created fork: ${createdFork.data.owner.login}/${createdFork.data.name}`,
    )
    let n = 0
    while (n < 20) {
        n++
        try {
            const fork = await octokit.rest.repos.get({
                owner: createdFork.data.owner.login,
                repo: createdFork.data.name,
            })
            break
        } catch (error) {
            if (error instanceof RequestError && error.status === 404) {
                await new Promise((resolve) => setTimeout(resolve, 2 * 1000))

                console.info('Waiting for the fork to be created...', n)
                await new Promise((resolve) => setTimeout(resolve, 2000))
            } else {
                throw error
            }
        }
    }

    return {
        owner: accountLogin,
        repo: createdFork.data.name,
    }
}

export async function createPullRequestSuggestion({
    files,
    octokit,
    branch,
    owner,
    repo,
    fork,
    accountLogin,
    title = '',
    body,
}: {
    octokit: Octokit
    fork: boolean
    owner: string
    repo: string
    branch: string
    accountLogin: string
    body?: string
    title?: string
    files: { filePath: string; content: string }[]
}) {
    for (let f of files) {
        if (!f.filePath) {
            throw new AppError(`No file path for ${JSON.stringify(f)}`)
        }
    }
    console.log(
        `creating pr for ${owner}/${repo} branch ${branch}, fork? ${fork}`,
    )

    const branchName = `fumabase/${Date.now()}`

    let head = `refs/heads/${branchName}`
    let prOwner = owner
    let prRepo = repo

    if (fork) {
        if (!accountLogin) {
            throw new AppError(`No github account login to create fork with`)
        }
        const forkResult = await checkOrCreateFork({
            octokit,
            accountLogin,
            upstream: {
                owner,
                repo,
                branch,
            },
        })
        prOwner = forkResult.owner
        prRepo = forkResult.repo
        if (forkResult.owner !== owner) {
            head = forkResult.owner + ':' + branchName
        }
    }

    await pushChangesToBranch({
        owner: prOwner,
        repo: prRepo,
        branch: branchName,
        baseBranch: branch,
        files,
        octokit: octokit.rest,
    })
    if (!title) {
        title = `Update ${files.map((x) => '`' + x.filePath + '`').join(', ')}`
    }
    if (!body) {
        body = `I created this PR with [Fumabase](https://fumabase.com).`
    }
    const { data: pr } = await octokit.rest.pulls.create({
        owner,
        repo,
        head,
        base: `refs/heads/${branch}`,
        title,
        body,
    })

    const url = pr.html_url // `https://github.com/owner/repo/pull/${pr.number}`
    const prNumber = pr.number
    return { url, prNumber }
}

export async function pushToPrOrBranch({
    files,
    branch,
    auth,
    owner,
    repo,
    message,
}: {
    auth: string
    branch: string
    files: { filePath: string; content: string }[]
    owner: string
    repo: string
    message?: string
}) {
    const octokit = new Octokit({
        auth,
    })
    const [currentCommit, { data: githubUser }] = await Promise.all([
        getCurrentCommit({ octokit: octokit.rest, owner, repo, branch }),
        octokit.request('GET /user'),
    ])
    console.log(`last commit is ${currentCommit.commitSha}`)
    const {
        data: [pr],
    } = await octokit.rest.repos.listPullRequestsAssociatedWithCommit({
        commit_sha: currentCommit.commitSha,
        owner,
        repo,
    })
    let prUrl = pr?.html_url || ''
    const base = pr?.base?.repo
    let baseOwner = base?.owner?.login
    let prOwner = pr?.head?.repo?.owner?.login
    let baseRepo = base?.name
    if (!pr || prOwner === githubUser?.login) {
        console.log(
            `pushing files directly to ${owner}/${repo}/${branch}`,
            !pr ? 'because no pr found' : 'because owner === baseOwner',
        )
        const { commitUrl } = await changeGithubTree({
            owner,
            branch,
            create: files,
            octokit: octokit.rest,
            move: [],
            remove: [],
            repo,
        })
        return { commitUrl, prUrl }
    }

    const [withBlobs] = await Promise.all([
        Promise.all(
            files.map(async (x) => {
                const encoding = 'utf-8'
                const blobData = await octokit.rest.git.createBlob({
                    owner: baseOwner,
                    repo: baseRepo,
                    content: x.content,
                    encoding,
                })
                return {
                    ...x,
                    blobSha: blobData.data.sha,
                    blob: blobData.data,
                }
            }),
        ),
    ])

    console.log('creating new tree')
    const { data: newTree } = await octokit.rest.git.createTree({
        owner: baseOwner,
        repo: baseRepo,
        tree: withBlobs.map(({ blobSha, filePath }) => ({
            path: filePath,
            mode: `100644`,
            type: `blob`,
            sha: blobSha,
        })),
        base_tree: currentCommit.treeSha,
    })

    console.log('creating commit')
    const { data: newCommit } = await octokit.rest.git.createCommit({
        owner: baseOwner,
        repo: baseRepo,
        message:
            message ||
            getCommitMessage({
                filePaths: files.map((x) => x.filePath),
            }),
        tree: newTree.sha,
        committer: committer,
        parents: [currentCommit.commitSha],
    })

    console.log(`updating ref`, branch)
    await octokit.rest.git
        .deleteRef({
            owner: baseOwner,
            repo: baseRepo,
            ref: `heads/${branch}`,
        })
        .catch((e) => {
            if (
                e instanceof RequestError &&
                e.message.toLowerCase().includes('does not exist')
            ) {
                return {}
            }
            throw e
        })
    await octokit.rest.git.createRef({
        owner: baseOwner,
        repo: baseRepo,
        ref: `refs/heads/${branch}`,
        sha: newCommit.sha,
    })

    try {
        const {} = await octokit.rest.git.updateRef({
            owner,
            repo,
            ref: `heads/${branch}`,
            // force: true, // or errors with Update is not a fast forward
            sha: newCommit.sha,
        })
    } catch (e) {
        const fastForwardErr =
            e instanceof RequestError &&
            (e.status === 422 || e.status === 409) &&
            /fast forward/i.test(e.message)

        if (!fastForwardErr) throw e // different problem → bubble up

        // 1️⃣  fetch new tip
        const { commitSha: latest } = await getCurrentCommit({
            octokit: octokit.rest,
            owner,
            repo,
            branch,
        })

        // 2️⃣  re-create commit with latest as parent
        const { data: rebased } = await octokit.rest.git.createCommit({
            owner,
            repo,
            message:
                message ||
                getCommitMessage({
                    filePaths: files.map((f) => f.filePath),
                }),
            tree: newTree.sha, // same tree you already built
            parents: [latest], // NEW parent!
            committer,
        })

        // 3️⃣  fast-forward now succeeds
        await octokit.rest.git.updateRef({
            owner,
            repo,
            ref: `heads/${branch}`,
            sha: rebased.sha,
        })
    }
    await octokit.rest.git
        .deleteRef({
            owner: baseOwner,
            repo: baseRepo,
            ref: `heads/${branch}`,
        })
        .catch((e) => null)

    return { prUrl }
}

export async function getRepoFilesWithCache({
    githubBranch,
    githubOwner,
    githubRepo,
    octokit,
}: {
    githubOwner: string
    githubBranch: string
    githubRepo: string
    octokit: Octokit
}): Promise<{
    allAssetPaths: string[]
    nodes: Array<{ slug: string; pageId: string; size: number }>
}> {
    const key = `${githubOwner}/${githubRepo}/${githubBranch}`
    const cached = repoFilesCache.get(key)
    if (cached && Date.now() - cached.timestamp < 1000 * 60) {
        return cached.data
    }

    try {
        console.log(`getting github tree ${githubBranch}`)
        const tree = await octokit.rest.git.getTree({
            owner: githubOwner,
            repo: githubRepo,
            tree_sha: githubBranch,
            recursive: 'true',
        })
        const files = tree.data.tree.filter((file) => {
            if (file.type !== 'blob') {
                return false
            }
            if (!file.path) {
                return false
            }

            return true
        })
        const allAssetPaths = files.map((x) => x.path).filter(isTruthy)

        const markdownExtensions = ['.md', '.markdown', '.mdx']
        const nodes = files
            .filter((file) => {
                return markdownExtensions.some((ext) =>
                    file?.path?.endsWith(ext),
                )
            })
            .map((x) => {
                const pageSlug = addFrontSlashToPath(x.path)

                const pageId = githubFileToPageId({
                    githubBranch,
                    githubOwner,
                    githubRepo,
                    pageSlug,
                })
                return {
                    slug: pageSlug,
                    pageId,
                    size: x.size || 0,
                }
            })
        console.log(
            `found ${nodes.length} markdown files in repo ${githubOwner}/${githubRepo}`,
        )
        const res = {
            nodes,
            allAssetPaths,
        }
        repoFilesCache.set(key, { data: res, timestamp: Date.now() })
        return res
    } catch (e) {
        if (e instanceof RequestError && e.status === 404) {
            console.log(`repo not found ${githubOwner}/${githubRepo}`)
            return {
                nodes: [],
                allAssetPaths: [],
            }
        }
        throw e
    }
}

export function githubFileToPageId({
    githubOwner,
    githubRepo,
    githubBranch,
    pageSlug,
}: {
    githubOwner: string
    githubRepo: string
    githubBranch: string
    pageSlug: string
}) {
    // Simple hash implementation to replace missing 'hash' function
    const str = `${githubOwner}:${githubRepo}:${githubBranch}:${pageSlug || ''}`
    let hash = 0
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i)
        hash = (hash << 5) - hash + char
        hash = hash & hash // Convert to 32bit integer
    }
    return Math.abs(hash).toString()
}
