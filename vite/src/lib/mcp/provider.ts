/**
 * MCP virtual tab provider.
 *
 * Implements VirtualTabProvider to generate documentation pages from an MCP
 * (Model Context Protocol) definition. Reads tool, resource, and prompt
 * definitions from a local JSON file or a remote Streamable HTTP MCP server,
 * then generates one page per tool and one per resource.
 *
 * Local file format:
 *   { tools?: Tool[], resources?: Resource[], prompts?: Prompt[], serverUrl?: string }
 *
 * The Tool/Resource/Prompt shapes match the official MCP specification
 * (imported from @modelcontextprotocol/sdk).
 *
 * Supports selective mode: users can interleave custom MDX pages with
 * auto-generated tool pages using the `groups`/`pages` + `"..."` sentinel,
 * identical to how OpenAPI's selective mode works.
 */

import fs from 'node:fs'
import path from 'node:path'
import type { Tool, Resource, Prompt } from '@modelcontextprotocol/sdk/types.js'
import type { ConfigNavGroup, ConfigNavTab } from '../../config.ts'
import type { VirtualTabProvider, VirtualTabResult } from '../virtual-tab-provider.ts'
import { buildVirtualPageMdx } from '../virtual-page-mdx.ts'
import { sample } from '../sample.ts'
import { logger, formatHolocronWarning } from '../logger.ts'

/* ── Types ────────────────────────────────────────────────────────────── */

/** Shape of the local MCP definition JSON file. */
interface MCPDefinitionFile {
  /** Optional URL of the live MCP server (used for "try in chat" later). */
  serverUrl?: string
  tools?: Tool[]
  resources?: Resource[]
  prompts?: Prompt[]
}

/* ── Helpers ──────────────────────────────────────────────────────────── */

/** Convert a tool/resource name to a URL-safe kebab-case slug. */
function nameToSlug(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
}

/** Resolve a file path, probing pagesDir first then projectRoot. */
function resolveFile(source: string, pagesDir: string, projectRoot: string): string {
  for (const dir of [pagesDir, projectRoot]) {
    const abs = path.join(dir, source)
    if (fs.existsSync(abs)) return abs
  }
  throw new Error(
    `[holocron] MCP definition file "${source}" not found. ` +
    `Looked in "${pagesDir}" and "${projectRoot}".`,
  )
}

/** Load MCP definitions from a local JSON file. */
function loadFromFile(filePath: string): MCPDefinitionFile {
  const raw = fs.readFileSync(filePath, 'utf-8')
  const parsed = JSON.parse(raw) as MCPDefinitionFile
  return {
    serverUrl: parsed.serverUrl,
    tools: parsed.tools ?? [],
    resources: parsed.resources ?? [],
    prompts: parsed.prompts ?? [],
  }
}

/** Load MCP definitions from a remote Streamable HTTP server.
 *  Uses the official @modelcontextprotocol/sdk client. */
async function loadFromRemote(url: string): Promise<MCPDefinitionFile> {
  // Dynamic import to avoid bundling the SDK for users who only use local files
  const { Client } = await import('@modelcontextprotocol/sdk/client/index.js')
  const { StreamableHTTPClientTransport } = await import('@modelcontextprotocol/sdk/client/streamableHttp.js')

  const client = new Client({ name: 'holocron', version: '1.0.0' })
  const transport = new StreamableHTTPClientTransport(new URL(url))

  try {
    await client.connect(transport)

    const [toolsResult, resourcesResult, promptsResult] = await Promise.all([
      client.listTools().catch(() => ({ tools: [] as Tool[] })),
      client.listResources().catch(() => ({ resources: [] as Resource[] })),
      client.listPrompts().catch(() => ({ prompts: [] as Prompt[] })),
    ])

    return {
      serverUrl: url,
      tools: toolsResult.tools ?? [],
      resources: resourcesResult.resources ?? [],
      prompts: promptsResult.prompts ?? [],
    }
  } finally {
    await client.close().catch(() => {})
  }
}

/** Resolve the local file path for an MCP source (returns undefined for URLs). */
function resolveLocalPath(source: string, pagesDir: string, projectRoot: string): string | undefined {
  if (source.startsWith('http://') || source.startsWith('https://')) return undefined
  return resolveFile(source, pagesDir, projectRoot)
}

/** Load MCP definitions from file or remote URL. */
async function loadMCPDefinitions(source: string, resolvedPath: string | undefined): Promise<MCPDefinitionFile> {
  if (!resolvedPath) return loadFromRemote(source)
  return loadFromFile(resolvedPath)
}

/* ── MDX generation ───────────────────────────────────────────────────── */

function buildToolMdx(tool: Tool): string {
  const inputSchema = tool.inputSchema as Record<string, unknown> | undefined
  const outputSchema = (tool as any).outputSchema as Record<string, unknown> | undefined
  const execution = (tool as any).execution as { taskSupport?: string } | undefined
  const exampleArgs = inputSchema ? sample(inputSchema) : {}
  const requestJson = JSON.stringify(
    { method: 'tools/call', params: { name: tool.name, arguments: exampleArgs } },
    null,
    2,
  )

  // Build aside: request example + optional response example
  const asideBlocks = [
    '<RequestExample>',
    '',
    '```json lines=false',
    requestJson,
    '```',
    '',
    '</RequestExample>',
  ]

  if (outputSchema) {
    const exampleOutput = sample(outputSchema)
    asideBlocks.push(
      '',
      '<ResponseExample>',
      '',
      '```json lines=false',
      JSON.stringify(exampleOutput, null, 2),
      '```',
      '',
      '</ResponseExample>',
    )
  }

  const aside = asideBlocks.join('\n')

  const propsJson = JSON.stringify({
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema,
    ...(outputSchema && { outputSchema }),
    annotations: (tool as any).annotations,
    ...(execution && { execution }),
    title: (tool as any).annotations?.title,
  })

  return buildVirtualPageMdx({
    frontmatter: {
      title: (tool as any).annotations?.title || tool.name,
      sidebarTitle: tool.name,
      description: tool.description ? plainText(tool.description).slice(0, 200) : undefined,
      tag: 'TOOL',
      tagColor: 'purple',
      gridGap: 30,
    },
    aside,
    body: `<MCPTool ${propsToJsx(propsJson)} />`,
  })
}

function buildResourceMdx(resource: Resource): string {
  const propsJson = JSON.stringify({
    name: resource.name,
    uri: resource.uri,
    description: resource.description,
    mimeType: resource.mimeType,
  })

  return buildVirtualPageMdx({
    frontmatter: {
      title: resource.name,
      description: resource.description ? plainText(resource.description).slice(0, 200) : undefined,
      tag: 'SOURCE',
      tagColor: 'blue',
    },
    body: `<MCPResource ${propsToJsx(propsJson)} />`,
  })
}

/** Render a JSON string as JSX spread props. */
function propsToJsx(json: string): string {
  return `{...${json}}`
}

/** Strip markdown formatting to produce plain text for meta descriptions. */
function plainText(md: string): string {
  return md
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // links
    .replace(/[*_~`#]/g, '') // emphasis + headings
    .replace(/\n+/g, ' ')
    .trim()
}

/* ── Provider ─────────────────────────────────────────────────────────── */

export const mcpProvider: VirtualTabProvider = {
  name: 'mcp',
  claims: (tab) => !!tab.mcp,

  async generate({ tab, projectRoot, pagesDir }): Promise<VirtualTabResult> {
    const base = tab.base ?? 'mcp'
    const prefix = base ? `${base}/` : ''

    // Resolve local file path BEFORE try/catch so it's always in watchPaths.
    // This ensures HMR recovery works: if the file becomes invalid JSON during
    // editing, the file stays watched and fixing it triggers re-sync.
    const resolvedPath = resolveLocalPath(tab.mcp!, pagesDir, projectRoot)
    const watchPaths: string[] = resolvedPath ? [resolvedPath] : []

    let defs: MCPDefinitionFile
    try {
      defs = await loadMCPDefinitions(tab.mcp!, resolvedPath)
    } catch (error) {
      logger.warn(
        formatHolocronWarning(
          `Failed to load MCP definitions from "${tab.mcp}": ${error instanceof Error ? error.message : String(error)}. ` +
          `The MCP tab will have no generated pages.`,
        ),
      )
      return { groups: tab.groups ?? [], mdxContent: {}, watchPaths }
    }

    const tools = defs.tools ?? []
    const resources = defs.resources ?? []

    if (tools.length === 0 && resources.length === 0) {
      logger.warn(
        formatHolocronWarning(
          `MCP definition "${tab.mcp}" contains no tools or resources. The tab will be empty.`,
        ),
      )
    }

    const mdxContent: Record<string, string> = {}
    // Track slug owners to detect collisions (e.g. tools "get_user" and
    // "get-user" both map to slug "get-user" after normalization).
    const slugOwners = new Map<string, string>()

    function claimSlug(slug: string, owner: string) {
      const existing = slugOwners.get(slug)
      if (existing && existing !== owner) {
        logger.warn(
          formatHolocronWarning(
            `Two MCP entries map to the same page slug "${slug}" in tab "${tab.tab}" ("${existing}" and "${owner}"). ` +
            `Rename one entry or set a different base.`,
          ),
        )
      }
      slugOwners.set(slug, owner)
    }

    // Build slug → MDX for each tool
    const toolSlugs = new Map<string, string>() // tool.name → slug
    for (const tool of tools) {
      const slug = `${prefix}${nameToSlug(tool.name)}`
      claimSlug(slug, `tool:${tool.name}`)
      toolSlugs.set(tool.name, slug)
      mdxContent[slug] = buildToolMdx(tool)
    }

    // Build slug → MDX for each resource
    const resourceSlugs = new Map<string, string>() // resource.name → slug
    for (const resource of resources) {
      const slug = `${prefix}resources/${nameToSlug(resource.name)}`
      claimSlug(slug, `resource:${resource.name}`)
      resourceSlugs.set(resource.name, slug)
      mdxContent[slug] = buildResourceMdx(resource)
    }

    // Build navigation groups
    const hasAuthoredGroups = tab.groups && tab.groups.length > 0
      && tab.groups.some((g) => g.pages.length > 0)

    let groups: ConfigNavGroup[]

    if (hasAuthoredGroups) {
      // Selective mode: walk authored groups, resolve tool names to slugs,
      // and expand "..." with remaining tools/resources.
      const referencedSlugs = new Set<string>()
      groups = resolveSelectiveGroups(
        tab.groups!,
        toolSlugs,
        resourceSlugs,
        referencedSlugs,
        tools,
        resources,
        tab.tab,
      )
    } else {
      // Dedicated mode: auto-group tools and resources
      groups = []
      if (tools.length > 0) {
        groups.push({
          group: 'Tools',
          pages: tools.map((t) => toolSlugs.get(t.name)!),
        })
      }
      if (resources.length > 0) {
        groups.push({
          group: 'Resources',
          pages: resources.map((r) => resourceSlugs.get(r.name)!),
        })
      }
    }

    return { groups, mdxContent, watchPaths }
  },
}

/* ── Selective mode ───────────────────────────────────────────────────── */

const REST_PLACEHOLDER = '...'

type PageEntry = string | ConfigNavGroup

function resolveSelectiveGroups(
  authoredGroups: ConfigNavGroup[],
  toolSlugs: Map<string, string>,
  resourceSlugs: Map<string, string>,
  referencedSlugs: Set<string>,
  tools: Tool[],
  resources: Resource[],
  tabName: string,
): ConfigNavGroup[] {
  const allByName = new Map<string, string>([...toolSlugs, ...resourceSlugs])

  // Recursively resolve a single page entry: tool names → slugs, nested
  // groups recurse, "..." stays as placeholder. Tracks references so rest
  // expansion excludes already-listed tools.
  let placeholderCount = 0

  function resolveEntry(entry: PageEntry): PageEntry {
    if (typeof entry !== 'string') {
      // Nested group — recurse into its pages
      return { ...entry, pages: entry.pages.map(resolveEntry) }
    }
    if (entry === REST_PLACEHOLDER) {
      placeholderCount++
      if (placeholderCount > 1) {
        throw new Error(
          `[holocron] tab "${tabName}" has more than one "..." entry. ` +
          `Only one rest-expansion is allowed per MCP tab.`,
        )
      }
      return entry
    }
    const slug = allByName.get(entry)
    if (slug) {
      referencedSlugs.add(slug)
      return slug
    }
    return entry
  }

  const resolved = authoredGroups.map((group) => ({
    ...group,
    pages: group.pages.map(resolveEntry),
  }))

  if (placeholderCount === 0) return resolved

  // Build rest groups from unreferenced tools/resources
  const restGroups: ConfigNavGroup[] = []
  const unrefTools = tools.filter((t) => !referencedSlugs.has(toolSlugs.get(t.name)!))
  const unrefResources = resources.filter((r) => !referencedSlugs.has(resourceSlugs.get(r.name)!))

  if (unrefTools.length > 0) {
    restGroups.push({
      group: 'Tools',
      pages: unrefTools.map((t) => toolSlugs.get(t.name)!),
    })
  }
  if (unrefResources.length > 0) {
    restGroups.push({
      group: 'Resources',
      pages: unrefResources.map((r) => resourceSlugs.get(r.name)!),
    })
  }

  // Replace "..." with rest groups (walks recursively)
  function splicePlaceholder(groups: ConfigNavGroup[]): ConfigNavGroup[] {
    const result: ConfigNavGroup[] = []
    for (const group of groups) {
      const placeholderIdx = group.pages.findIndex((p) => p === REST_PLACEHOLDER)
      if (placeholderIdx === -1) {
        // Check nested groups for placeholder
        const hasNested = group.pages.some((p) => typeof p !== 'string')
        if (hasNested) {
          const nestedResolved = group.pages.map((p) => {
            if (typeof p !== 'string' && 'pages' in p) {
              const inner = splicePlaceholder([p as ConfigNavGroup])
              return inner.length === 1 ? inner[0]! : p
            }
            return p
          })
          result.push({ ...group, pages: nestedResolved })
        } else {
          result.push(group)
        }
        continue
      }

      const before = group.pages.slice(0, placeholderIdx)
      const after = group.pages.slice(placeholderIdx + 1)

      if (before.length > 0 || after.length > 0) {
        if (before.length > 0) result.push({ ...group, pages: before })
        result.push(...restGroups)
        if (after.length > 0) result.push({ ...group, pages: after })
      } else {
        result.push(...restGroups)
      }
    }
    return result
  }

  return splicePlaceholder(resolved)
}
