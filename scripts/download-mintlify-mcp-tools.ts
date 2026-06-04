// Downloads MCP tool definitions from Mintlify's admin or search MCP servers.
// Usage:
//   bun scripts/download-mintlify-mcp-tools.ts                           # search MCP (no auth)
//   bun scripts/download-mintlify-mcp-tools.ts --admin --token <TOKEN>   # admin MCP (requires OAuth token)
//
// The admin MCP requires a bearer token obtained via OAuth at https://mcp.mintlify.com.
// To get a token, connect the admin MCP to Claude/Cursor first, then extract the token
// from the MCP session, or use the OAuth flow described at:
// https://www.mintlify.com/docs/ai/mintlify-mcp

const SEARCH_MCP_URL = 'https://mintlify.com/docs/mcp'
const ADMIN_MCP_URL = 'https://mcp.mintlify.com'

interface JsonRpcRequest {
	jsonrpc: '2.0'
	id: number
	method: string
	params: Record<string, unknown>
}

async function sendMcpRequest(
	url: string,
	request: JsonRpcRequest,
	headers: Record<string, string> = {},
): Promise<any> {
	const res = await fetch(url, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Accept: 'application/json, text/event-stream',
			...headers,
		},
		body: JSON.stringify(request),
		redirect: 'follow',
	})

	if (!res.ok) {
		const text = await res.text()
		throw new Error(`MCP request failed (${res.status}): ${text}`)
	}

	const contentType = res.headers.get('content-type') || ''
	const text = await res.text()

	// SSE format: parse "data:" lines
	if (contentType.includes('text/event-stream') || text.startsWith('event:')) {
		const dataLine = text
			.split('\n')
			.find((line) => line.startsWith('data: '))
		if (!dataLine) {
			throw new Error(`No data line in SSE response: ${text}`)
		}
		return JSON.parse(dataLine.slice(6))
	}

	return JSON.parse(text)
}

async function downloadMcpTools(opts: { admin: boolean; token?: string }) {
	const url = opts.admin ? ADMIN_MCP_URL : SEARCH_MCP_URL
	const headers: Record<string, string> = {}

	if (opts.token) {
		headers['Authorization'] = `Bearer ${opts.token}`
	}

	console.log(`Connecting to ${url}...`)

	// Step 1: Initialize
	const initResponse = await sendMcpRequest(
		url,
		{
			jsonrpc: '2.0',
			id: 1,
			method: 'initialize',
			params: {
				protocolVersion: '2025-03-26',
				capabilities: {},
				clientInfo: { name: 'holocron-mcp-downloader', version: '1.0.0' },
			},
		},
		headers,
	)

	const sessionId =
		initResponse?.result?.meta?.sessionId ||
		initResponse?.result?.sessionId ||
		undefined

	console.log(
		`Initialized. Server: ${initResponse?.result?.serverInfo?.name} v${initResponse?.result?.serverInfo?.version}`,
	)

	// Add session ID if returned
	const toolHeaders = { ...headers }
	if (sessionId) {
		toolHeaders['Mcp-Session-Id'] = sessionId
	}

	// Step 2: List tools
	const toolsResponse = await sendMcpRequest(
		url,
		{
			jsonrpc: '2.0',
			id: 2,
			method: 'tools/list',
			params: {},
		},
		toolHeaders,
	)

	const tools = toolsResponse?.result?.tools
	if (!tools) {
		console.error('No tools found in response:')
		console.error(JSON.stringify(toolsResponse, null, 2))
		process.exit(1)
	}

	console.log(`Found ${tools.length} tools`)

	const output = {
		server: initResponse?.result?.serverInfo,
		protocolVersion: initResponse?.result?.protocolVersion,
		tools,
		downloadedAt: new Date().toISOString(),
	}

	const filename = opts.admin
		? 'docs/mintlify-admin-mcp-tools.json'
		: 'docs/mintlify-search-mcp-tools.json'

	const fs = await import('node:fs')
	const path = await import('node:path')
	const outPath = path.join(import.meta.dirname, '..', filename)
	fs.writeFileSync(outPath, JSON.stringify(output, null, 2) + '\n')
	console.log(`Saved to ${filename}`)
}

// Parse args
const args = process.argv.slice(2)
const admin = args.includes('--admin')
const tokenIdx = args.indexOf('--token')
const token = tokenIdx !== -1 ? args[tokenIdx + 1] : undefined

if (admin && !token) {
	console.error(
		'Admin MCP requires --token. Get one via OAuth at https://mcp.mintlify.com',
	)
	process.exit(1)
}

downloadMcpTools({ admin, token })
