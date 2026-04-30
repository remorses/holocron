/**
 * Chat Pi tools for Holocron's AI endpoint.
 *
 * Builds the in-memory docs filesystem for just-bash and optionally injects
 * remote `SKILL.md` files plus a compact available-skills XML catalog.
 */

import { Bash } from 'just-bash/browser'
import type { AgentTool } from '@mariozechner/pi-agent-core'
import {
  createBashTool,
  createEditTool,
  createLsTool,
  createReadTool,
  createWriteTool,
} from '@mariozechner/pi-coding-agent'
import { parseFrontmatterObject } from './frontmatter.ts'

export type ChatPiToolsOptions = {
  files: Record<string, string>
  skillUrls?: string[]
}

export type ChatPiTools = AgentTool<any>[]

type ResolvedSkill = {
  name: string
  description: string
  markdown: string
  path: string
}

const skillCache = new Map<string, Promise<ResolvedSkill>>()

export function normalizeSkillUrl(input: string): string {
  const url = new URL(input)
  if (url.hostname !== 'github.com') {
    return url.toString()
  }

  const parts = url.pathname.split('/').filter(Boolean)
  if (parts.length >= 5 && parts[2] === 'blob') {
    const [owner, repo, , ref, ...rest] = parts
    return `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${rest.join('/')}`
  }

  return url.toString()
}

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", `'\\''`)}'`
}

function createAbortController(signal?: AbortSignal) {
  const controller = new AbortController()
  if (!signal) return controller
  if (signal.aborted) controller.abort()
  else signal.addEventListener('abort', () => controller.abort(), { once: true })
  return controller
}

async function getCachedSkill(inputUrl: string): Promise<ResolvedSkill> {
  const cached = skillCache.get(inputUrl)
  if (cached) return cached

  const promise = (async () => {
    const response = await fetch(normalizeSkillUrl(inputUrl))
    if (!response.ok) {
      throw new Error(`Failed to fetch skill from ${inputUrl}: ${response.status} ${response.statusText}`)
    }

    const markdown = await response.text()
    const frontmatter = parseFrontmatterObject(markdown)
    const name = typeof frontmatter.name === 'string' ? frontmatter.name.trim() : ''
    const description = typeof frontmatter.description === 'string' ? frontmatter.description.trim() : ''

    if (!name || !description) {
      throw new Error(`Invalid skill frontmatter from ${inputUrl}: expected string name and description`)
    }

    return {
      name,
      description,
      markdown,
      path: `/docs/skills/${name}/SKILL.md`,
    }
  })()

  skillCache.set(inputUrl, promise)
  try {
    return await promise
  } catch (error) {
    skillCache.delete(inputUrl)
    throw error
  }
}

export async function createChatPiTools({
  files,
  skillUrls = [],
}: ChatPiToolsOptions): Promise<ChatPiTools> {
  const skills = await Promise.all(skillUrls.map((url) => getCachedSkill(url)))
  const bash = new Bash({
    files: {
      ...files,
      ...Object.fromEntries(skills.map((skill) => [skill.path, skill.markdown])),
    },
    cwd: '/docs',
  })

  const skillXml = skills.length === 0
    ? ''
    : [
        '<available_skills>',
        ...skills.flatMap((skill) => [
          '  <skill>',
          `    <name>${escapeXml(skill.name)}</name>`,
          `    <description>${escapeXml(skill.description)}</description>`,
          `    <location>${escapeXml(skill.path)}</location>`,
          '  </skill>',
        ]),
        '</available_skills>',
      ].join('\n')

  const extraInstructions = [
    'The filesystem is an in-memory documentation workspace rooted at /docs.',
    'Use read/edit/write/ls for file operations. Use bash for grep, rg, wc, cat, and other shell-style searches.',
    skills.length === 0
      ? ''
      : [
          'Skills are available as markdown files in the virtual filesystem.',
          'Read the referenced SKILL.md file when a skill is relevant.',
          skillXml,
        ].join('\n'),
  ].filter(Boolean).join('\n')

  const readFile = async (path: string) => Buffer.from(await bash.fs.readFile(path))
  const writeFile = bash.fs.writeFile.bind(bash.fs)

  return [
    createReadTool('/docs', {
      operations: {
        readFile,
        access: async (path) => {
          await readFile(path)
        },
      },
    }),
    createWriteTool('/docs', {
      operations: {
        writeFile,
        mkdir: async (dir) => {
          const result = await bash.exec(`mkdir -p ${shellQuote(dir)}`)
          if (result.exitCode !== 0) throw new Error(result.stderr || result.stdout || `mkdir failed: ${dir}`)
        },
      },
    }),
    createEditTool('/docs', {
      operations: {
        readFile,
        writeFile,
        access: async (path) => {
          await readFile(path)
        },
      },
    }),
    createLsTool('/docs', {
      operations: {
        exists: async (path) => (await bash.exec(`test -e ${shellQuote(path)}`)).exitCode === 0,
        stat: async (path) => {
          const isDirectory = (await bash.exec(`test -d ${shellQuote(path)}`)).exitCode === 0
          return { isDirectory: () => isDirectory }
        },
        readdir: async (path) => {
          const result = await bash.exec(`ls -1A ${shellQuote(path)}`)
          if (result.exitCode !== 0) throw new Error(result.stderr || result.stdout || `ls failed: ${path}`)
          return result.stdout.split('\n').filter(Boolean)
        },
      },
    }),
    createBashTool('/docs', {
      operations: {
        exec: async (command, cwd, { onData, signal, timeout }) => {
          const controller = createAbortController(signal)
          const timeoutId = timeout && timeout > 0
            ? setTimeout(() => controller.abort(), timeout * 1000)
            : undefined

          try {
            const execOptions: Parameters<typeof bash.exec>[1] = { cwd, signal: controller.signal }
            const result = await bash.exec(command, execOptions)
            if (result.stdout) onData(Buffer.from(result.stdout))
            if (result.stderr) onData(Buffer.from(result.stderr))
            return { exitCode: result.exitCode }
          } catch (error) {
            if (error instanceof Error && error.name === 'AbortError') throw new Error('aborted')
            throw error
          } finally {
            if (timeoutId) clearTimeout(timeoutId)
          }
        },
      },
    }),
  ].map((tool) => ({ ...tool, description: `${tool.description}\n\n${extraInstructions}` }))
}

export const createChatBashTool = createChatPiTools
