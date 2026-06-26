/**
 * Chat bash tool for the hosted Holocron AI route.
 *
 * Builds the in-memory docs filesystem for just-bash and optionally injects
 * remote `SKILL.md` files plus a compact available-skills XML catalog.
 */

import { tool } from 'ai'
import { Bash } from 'just-bash/browser'
import { z } from 'zod'

export type ChatBashToolOptions = {
  files: Record<string, string>
  skillUrls?: string[]
}

type ResolvedSkill = {
  name: string
  description: string
  markdown: string
  path: string
}

const skillCache = new Map<string, Promise<ResolvedSkill>>()

function parseSkillFrontmatter(markdown: string): { name?: string; description?: string } {
  const match = /^---\n([\s\S]*?)\n---/.exec(markdown)
  if (!match) return {}

  const frontmatter: { name?: string; description?: string } = {}
  for (const line of match[1]!.split('\n')) {
    const separator = line.indexOf(':')
    if (separator === -1) continue

    const key = line.slice(0, separator).trim()
    const value = line.slice(separator + 1).trim().replace(/^['"]|['"]$/g, '')
    if (key === 'name') frontmatter.name = value
    if (key === 'description') frontmatter.description = value
  }
  return frontmatter
}

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

async function getCachedSkill(inputUrl: string): Promise<ResolvedSkill> {
  const cached = skillCache.get(inputUrl)
  if (cached) return cached

  const promise = (async () => {
    const response = await fetch(normalizeSkillUrl(inputUrl))
    if (!response.ok) {
      throw new Error(`Failed to fetch skill from ${inputUrl}: ${response.status} ${response.statusText}`)
    }

    const markdown = await response.text()
    const frontmatter = parseSkillFrontmatter(markdown)
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

export async function createChatBashTool({
  files,
  skillUrls = [],
}: ChatBashToolOptions) {
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

  return tool({
    description: [
      'Execute bash commands in the in-memory documentation filesystem.',
      'Working directory: /docs',
      'Use grep -rn "term" /docs to search and cat /docs/slug.mdx to read files.',
      skills.length === 0
        ? ''
        : [
            'Skills are available as markdown files in the virtual filesystem.',
            'Read the referenced SKILL.md file when a skill is relevant.',
            skillXml,
          ].join('\n'),
    ].filter(Boolean).join('\n'),
    inputSchema: z.object({
      command: z.string().describe('The bash command to execute'),
    }),
    execute: async ({ command }: { command: string }) => {
      const result = await bash.exec(command)
      return {
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
      }
    },
  })
}
