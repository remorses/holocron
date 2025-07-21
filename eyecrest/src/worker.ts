/* -----------------------------------------------------------------------
   Cloudflare Worker + Durable Object (SQLite) in one file
   -------------------------------------------------------------------- */

import { McpAgent } from 'agents/mcp'

import { parseTar } from '@mjackson/tar-parser'
import { DurableObject } from 'cloudflare:workers'
import { Spiceflow } from 'spiceflow'
import { cors } from 'spiceflow/cors'
import { openapi } from 'spiceflow/openapi'
import { mcp, addMcpTools } from 'spiceflow/mcp'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'

import { parseWithTreeSitter } from './tree-sitter-parser.js'
import { findLineNumberInContent } from './utils.js'

/* ---------- ENV interface ---------------------------- */

interface Env {
    REPO_CACHE: DurableObjectNamespace
    ASSETS: Fetcher
    GITHUB_TOKEN?: string
    CACHE_TTL_MS?: string // e.g. "21600000" (6 h)
}

/* ======================================================================
   Durable Object: per‑repo cache
   ==================================================================== */
export class RepoCache extends DurableObject {
    private sql: SqlStorage
    private ttl: number
    private owner?: string
    private repo?: string
    private branch?: string

    constructor(state: DurableObjectState, env: Env) {
        super(state, env)
        this.sql = state.storage.sql
        this.ttl = Number(env.CACHE_TTL_MS ?? 21_600_000) // 6 h default

        /* one‑time schema */
        this.sql.exec(`
      CREATE TABLE IF NOT EXISTS files (
        path          TEXT PRIMARY KEY,
        content       TEXT,
        firstFetched  INTEGER
      );
      CREATE VIRTUAL TABLE IF NOT EXISTS files_fts
        USING fts5(path, content, tokenize = 'porter');
      CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, val TEXT);
    `)
    }

    async getFiles(params: {
        owner: string
        repo: string
        branch: string
    }): Promise<Response> {
        this.owner = params.owner
        this.repo = params.repo
        this.branch = params.branch

        await this.ensureFresh()
        const rows = [...this.sql.exec('SELECT path FROM files ORDER BY path')]
        return json(rows.map((r) => r.path))
    }

    async getFile(params: {
        owner: string
        repo: string
        branch: string
        filePath: string
        showLineNumbers?: boolean
        start?: number
        end?: number
    }): Promise<Response> {
        this.owner = params.owner
        this.repo = params.repo
        this.branch = params.branch

        await this.ensureFresh()
        const results = [
            ...this.sql.exec(
                'SELECT content FROM files WHERE path = ?',
                params.filePath,
            ),
        ]
        const row = results.length > 0 ? results[0] : null

        if (!row) {
            return notFound()
        }

        const content = row.content as string

        // Apply line formatting if any formatting options are specified
        if (
            params.showLineNumbers ||
            params.start !== undefined ||
            params.end !== undefined
        ) {
            const formatted = formatFileWithLines(
                content,
                params.showLineNumbers || false,
                params.start,
                params.end,
            )
            return new Response(formatted, {
                headers: { 'content-type': 'text/plain; charset=utf-8' },
            })
        }

        // Return raw text content
        return new Response(content, {
            headers: { 'content-type': 'text/plain; charset=utf-8' },
        })
    }

    async searchFiles(params: {
        owner: string
        repo: string
        branch: string
        query: string
    }): Promise<Response> {
        this.owner = params.owner
        this.repo = params.repo
        this.branch = params.branch

        await this.ensureFresh()
        const searchQuery = decodeURIComponent(params.query)

        // Get both snippet and full content to find line numbers
        // SQLite snippet() extracts text around matches: snippet(table, column, start_mark, end_mark, ellipsis, max_tokens)
        // -1 means use all columns, '' for no highlighting marks, '...' as ellipsis, 64 max tokens
        const rows = [
            ...this.sql.exec(
                `SELECT
          files.path,
          files.content,
          snippet(files_fts, -1, '', '', '...', 64) as snippet
        FROM files_fts
        JOIN files ON files.path = files_fts.path
        WHERE files_fts MATCH ?
        ORDER BY rank`,
                searchQuery,
            ),
        ]

        const results = rows.map((r) => {
            const content = r.content as string
            // Remove HTML markup and clean up snippet
            const snippet = (r.snippet as string).replace(/<\/?mark>/g, '')

            // Remove ... only from start/end of snippet before searching for line numbers
            const cleanSnippet = snippet.replace(/^\.\.\.|\.\.\.$/, '')
            const lineNumber = findLineNumberInContent(content, cleanSnippet)

            // Create eyecrest.org URL
            const url = `https://eyecrest.org/repos/${params.owner}/${params.repo}/${params.branch}/file/${r.path}${lineNumber ? `?start=${lineNumber}` : ''}`

            return {
                path: r.path as string,
                snippet,
                url,
                lineNumber,
            }
        })

        const markdown = formatSearchResultsAsMarkdown(results)
        return new Response(markdown, {
            headers: { 'content-type': 'text/markdown; charset=utf-8' },
        })
    }

    /* ---------- populate / refresh ------------- */
    private async ensureFresh() {
        const results = [
            ...this.sql.exec("SELECT val FROM meta WHERE key = 'lastFetched'"),
        ]
        const meta = results.length > 0 ? results[0] : null
        const last = meta ? Number(meta.val) : 0
        if (Date.now() - last < this.ttl) {
            const now = Date.now()
            this.sql.exec(
                "INSERT OR REPLACE INTO meta VALUES ('lastFetched',?)",
                now,
            )

            const alarmTime = now + 24 * 60 * 60 * 1000
            await this.ctx.storage.setAlarm(alarmTime)
            return
        }

        await this.ctx.blockConcurrencyWhile(() => this.populate())
    }

    async alarm() {
        console.log('Alarm triggered - checking if repo data should be deleted')

        const results = [
            ...this.sql.exec("SELECT val FROM meta WHERE key = 'lastFetched'"),
        ]
        const meta = results.length > 0 ? results[0] : null
        const lastFetched = meta ? Number(meta.val) : 0

        const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000

        if (lastFetched < oneDayAgo) {
            console.log('Deleting repo data - not accessed in over 24 hours')
            this.sql.exec('DELETE FROM files')
            this.sql.exec('DELETE FROM files_fts')
            this.sql.exec('DELETE FROM meta')

            await this.ctx.storage.deleteAlarm()
            console.log('Repo data deleted and alarm cleared')
        } else {
            const nextAlarmTime = lastFetched + 24 * 60 * 60 * 1000
            await this.ctx.storage.setAlarm(nextAlarmTime)
            console.log(
                `Repo still active, rescheduled alarm for ${new Date(nextAlarmTime)}`,
            )
        }
    }

    private async populate() {
        if (!this.owner || !this.repo || !this.branch) {
            throw new Error(
                'Repository parameters (owner, repo, branch) are required for populate',
            )
        }

        // Use direct GitHub archive URL - no authentication required
        const url = `https://github.com/${this.owner}/${this.repo}/archive/${this.branch}.tar.gz`
        const r = await fetch(url)
        if (!r.ok) {
            throw new Error(
                `GitHub archive fetch failed (${r.status}) for ${this.owner}/${this.repo}/${this.branch}. URL: ${url}`,
            )
        }

        /* freshen: clear existing rows to avoid orphans */
        this.sql.exec('DELETE FROM files')
        this.sql.exec('DELETE FROM files_fts')

        const startTime = Date.now()

        const gz = r.body!.pipeThrough(new DecompressionStream('gzip'))
        await parseTar(gz, async (ent) => {
            if (ent.header.type !== 'file') return
            const rel = ent.name.split('/').slice(1).join('/')
            const buf = await ent.arrayBuffer()

            /* only store text files under 1MB */
            if (buf.byteLength < 1_000_000) {
                try {
                    const txt = new TextDecoder('utf-8', {
                        fatal: true,
                        ignoreBOM: false,
                    }).decode(buf)
                    // Store as text
                    this.sql.exec(
                        'INSERT INTO files VALUES (?,?,?)',
                        rel,
                        txt,
                        Date.now(),
                    )
                    // Index for FTS
                    this.sql.exec(
                        'INSERT INTO files_fts(path,content) VALUES (?,?)',
                        rel,
                        txt,
                    )
                } catch {
                    // Skip binary files
                }
            }
            // Skip large files
        })

        const endTime = Date.now()
        const durationSeconds = (endTime - startTime) / 1000

        console.log(`Data save completed in ${durationSeconds} seconds`)

        const now = Date.now()
        this.sql.exec(
            "INSERT OR REPLACE INTO meta VALUES ('lastFetched',?)",
            now,
        )

        const alarmTime = now + 24 * 60 * 60 * 1000
        await this.ctx.storage.setAlarm(alarmTime)
        console.log(`Set cleanup alarm for ${new Date(alarmTime)}`)
    }
}

const app = new Spiceflow()
    .state('env', {} as Env)
    .state('ctx', {} as ExecutionContext)
    .use(cors())
    .use(openapi({ path: '/openapi.json' }))
    .route({
        path: '/sse',
        handler: ({ request, state }) =>
            MyMCP.serveSSE('/sse').fetch(
                request as Request,
                state.env,
                state.ctx,
            ),
    })
    .route({
        path: '/sse/message',
        handler: ({ request, state }) =>
            MyMCP.serveSSE('/sse').fetch(
                request as Request,
                state.env,
                state.ctx,
            ),
    })
    .route({
        path: '/mcp',
        handler: ({ request, state }) =>
            MyMCP.serve('/mcp').fetch(request as Request, state.env, state.ctx),
    })
    .route({
        method: 'GET',
        path: '/repos/:owner/:repo/:branch/files',
        handler: async ({ params, state }) => {
            const { owner, repo, branch } = params
            const id = state.env.REPO_CACHE.idFromName(
                `${owner}/${repo}/${branch}`,
            )
            const stub = state.env.REPO_CACHE.get(id) as any as RepoCache
            return stub.getFiles({ owner, repo, branch })
        },
    })
    .route({
        method: 'GET',
        path: '/repos/:owner/:repo/:branch/file/*',
        handler: async ({ params, query, state }) => {
            const { owner, repo, branch, '*': filePath } = params
            const showLineNumbers = query.showLineNumbers === 'true'
            const start = query.start ? parseInt(query.start) : undefined
            const end = query.end ? parseInt(query.end) : undefined

            // If only start is provided, default to showing 50 lines
            const finalEnd =
                start !== undefined && end === undefined ? start + 49 : end

            const id = state.env.REPO_CACHE.idFromName(
                `${owner}/${repo}/${branch}`,
            )
            const stub = state.env.REPO_CACHE.get(id) as any as RepoCache
            return stub.getFile({
                owner,
                repo,
                branch,
                filePath,
                showLineNumbers,
                start,
                end: finalEnd,
            })
        },
    })
    .route({
        method: 'GET',
        path: '/repos/:owner/:repo/:branch/search/*',
        handler: async ({ params, state }) => {
            const { owner, repo, branch, '*': query } = params
            const id = state.env.REPO_CACHE.idFromName(
                `${owner}/${repo}/${branch}`,
            )
            const stub = state.env.REPO_CACHE.get(id) as any as RepoCache
            return stub.searchFiles({ owner, repo, branch, query })
        },
    })
    .route({
        method: 'GET',
        path: '/tree-sitter-demo/:extension',
        handler: async ({ params }) => {
            try {
                const extension = params.extension || 'md'
                const filePath = `example.${extension}`

                // Example content based on extension
                const getExampleContent = (ext: string) => {
                    switch (ext) {
                        case 'js':
                            return `function hello(name) {
  console.log("Hello, " + name + "!");
  return "Hello " + name;
}

const greeting = hello("Tree-sitter");
console.log(greeting);`

                        case 'md':
                            return `# Welcome to Tree-sitter Demo

This is a **markdown** document that demonstrates parsing capabilities.

## Features

- Parse markdown content directly
- Analyze with tree-sitter
- Extract document structure
- Support CommonMark spec

\`\`\`javascript
function hello() {
  console.log("Hello from markdown!");
}
\`\`\`

[Learn more](https://tree-sitter.github.io/)`

                        case 'mdx':
                            return `# Welcome to MDX

This is an **MDX** file that combines markdown with JSX.

export const Button = ({ children }) => (
  <button className="btn">{children}</button>
)

## Interactive Components

<Button>Click me!</Button>

You can use both markdown _syntax_ and React components!`

                        default:
                            return 'console.log("Hello World!");'
                    }
                }

                const sourceCode = getExampleContent(extension)
                const result = await parseWithTreeSitter(sourceCode, filePath)

                return json({
                    success: true,
                    message: `${result.language} content parsed with tree-sitter!`,
                    platform: 'Cloudflare Workers with web-tree-sitter',
                    filePath,
                    sourceCode,
                    ...result,
                })
            } catch (error) {
                return json({
                    success: false,
                    error:
                        error instanceof Error ? error.message : String(error),
                    stack: error instanceof Error ? error.stack : undefined,
                    hint: 'Check tree-sitter parser compatibility and WASM file loading',
                })
            }
        },
    })

// from example https://github.com/cloudflare/ai/blob/main/demos/remote-mcp-authless/src/index.ts
export class MyMCP extends McpAgent {
    server = new McpServer(
        {
            name: 'Gitchamber',
            version: '1.0.0',
        },
        {
            capabilities: {
                tools: {},
                resources: {},
            },
        },
    )

    async init() {
        await addMcpTools({
            mcpServer: this.server,
            app: app,
            ignorePaths: ['/sse', '/sse/message', '/mcp'],
        })
    }
}

export default {
    fetch: (req: Request, env: Env, ctx: ExecutionContext) =>
        app.handle(req, { state: { env, ctx } }),
}

const json = (x: unknown) =>
    new Response(JSON.stringify(x, null, 2), {
        headers: { 'content-type': 'application/json' },
    })
const notFound = () => new Response('Not found', { status: 404 })


function formatFileWithLines(
    contents: string,
    showLineNumbers: boolean,
    startLine?: number,
    endLine?: number,
): string {
    const lines = contents.split('\n')

    // Filter lines by range if specified
    const filteredLines = (() => {
        if (startLine !== undefined || endLine !== undefined) {
            const start = startLine ? Math.max(0, startLine - 1) : 0 // Convert to 0-based index, ensure non-negative
            const end = endLine ? Math.min(endLine, lines.length) : lines.length // Don't exceed file length
            return lines.slice(start, end)
        }
        return lines
    })()

    // Check if content is truncated
    const actualStart = startLine ? Math.max(0, startLine - 1) : 0
    const actualEnd = endLine ? Math.min(endLine, lines.length) : lines.length
    const hasContentAbove = actualStart > 0
    const hasContentBelow = actualEnd < lines.length

    // Show line numbers if requested or if line ranges are specified
    const shouldShowLineNumbers =
        showLineNumbers || startLine !== undefined || endLine !== undefined

    // Add line numbers if requested
    if (shouldShowLineNumbers) {
        const startLineNumber = startLine || 1
        const maxLineNumber = startLineNumber + filteredLines.length - 1
        const padding = maxLineNumber.toString().length

        const formattedLines = filteredLines.map((line, index) => {
            const lineNumber = startLineNumber + index
            const paddedNumber = lineNumber.toString().padStart(padding, ' ')
            return `${paddedNumber}  ${line}`
        })

        // Add end of file indicator if at the end
        const result: string[] = []
        result.push(...formattedLines)
        if (!hasContentBelow) {
            result.push('end of file')
        }

        return result.join('\n')
    }

    // For non-line-numbered output, also add end of file indicator
    const result: string[] = []
    result.push(...filteredLines)
    if (!hasContentBelow) {
        result.push('end of file')
    }

    return result.join('\n')
}

function formatSearchResultsAsMarkdown(
    results: Array<{
        path: string
        snippet: string
        url: string
        lineNumber: number | null
    }>,
): string {
    if (results.length === 0) {
        return 'No results found.'
    }

    return results
        .map((result) => {
            const lineInfo = result.lineNumber
                ? ` (line ${result.lineNumber})`
                : ''
            return `## [${result.path}](${result.url})${lineInfo}\n\n\`\`\`\n${result.snippet}\n\`\`\``
        })
        .join('\n\n---\n\n')
}
