// Discovers generation prompts and matches their local and remote references.

import fs from 'node:fs'
import path from 'node:path'
import childProcess from 'node:child_process'
import YAML from 'yaml'

export type LocalPromptReference = {
  kind: 'file' | 'directory'
  path: string
}

export type PromptReferences = {
  local: LocalPromptReference[]
  urls: string[]
}

export type MaintainPage = {
  path: string
  absolutePath: string
  siteRoot: string
  prompt: string | undefined
  references: PromptReferences
}

const LOCAL_REFERENCE_RE = /@((?:\.\.?\/|\/)[^\s<>"'`()\[\]{}]+)/g
const URL_REFERENCE_RE = /@(https?:\/\/[^\s<>"'`()\[\]{}]+)/g
const FRONTMATTER_RE = /^---\s*\n([\s\S]*?)\n---(?:\s*\n|$)/
const CONFIG_FILE_NAMES = new Set(['docs.json', 'docs.jsonc', 'holocron.jsonc'])
const stringOrCommentRe = /("(?:\\?[^])*?")|(\/\/.*)|(\/\*[^]*?\*\/)/g
const stringOrTrailingCommaRe = /("(?:\\?[^])*?")|(,\s*)(?=]|})/g

export function parseFrontmatterObject(content: string): Record<string, unknown> {
  const match = content.match(FRONTMATTER_RE)
  if (!match) return {}
  try {
    const parsed = YAML.parse(match[1]!)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {}
  } catch {
    return {}
  }
}

export function getGenerationPrompt(content: string): string | undefined {
  const prompt = parseFrontmatterObject(content).prompt
  return typeof prompt === 'string' && prompt.trim() ? prompt : undefined
}

function trimReference(value: string) {
  return value.replace(/[),.;:!?]+$/g, '')
}

function isInside(root: string, target: string) {
  const relative = path.relative(root, target)
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative))
}

function normalizeRepoPath(repoRoot: string, absolutePath: string) {
  return path.relative(repoRoot, absolutePath).split(path.sep).join('/')
}

function isTruthy<T>(value: T): value is NonNullable<T> {
  return value !== null && value !== undefined
}

function normalizeUrl(value: string) {
  const url = new URL(trimReference(value))
  url.hash = ''
  url.search = ''
  url.hostname = url.hostname.toLowerCase()
  if (url.hostname === 'github.com') url.pathname = url.pathname.toLowerCase()
  if ((url.protocol === 'https:' && url.port === '443') || (url.protocol === 'http:' && url.port === '80')) url.port = ''
  url.pathname = url.pathname === '/' ? '' : url.pathname.replace(/\/+$/, '')
  return url.href.replace(/\/$/, '')
}

export function extractPromptReferences({
  prompt,
  pagePath,
  repoRoot,
  baseSha,
}: {
  prompt: string
  pagePath: string
  repoRoot: string
  baseSha?: string
}): PromptReferences {
  const resolvedRepoRoot = fs.realpathSync(repoRoot)
  const pageDirectory = path.dirname(pagePath)
  const localByPath = new Map<string, LocalPromptReference>()

  for (const match of prompt.matchAll(LOCAL_REFERENCE_RE)) {
    const raw = trimReference(match[1]!)
    const lexicalPath = raw.startsWith('/')
      ? path.resolve(repoRoot, raw.replace(/^\/+/, ''))
      : path.resolve(pageDirectory, raw)
    if (!isInside(repoRoot, lexicalPath)) throw new Error(`Prompt reference escapes the repository: ${raw}`)
    if (!fs.existsSync(lexicalPath)) {
      const repoPath = normalizeRepoPath(repoRoot, lexicalPath)
      const previousType = baseSha
        ? (() => {
            try { return runGit(repoRoot, ['cat-file', '-t', `${baseSha}:${repoPath}`]).trim() }
            catch { return '' }
          })()
        : ''
      if (previousType !== 'blob' && previousType !== 'tree') throw new Error(`Prompt reference does not exist: ${raw}`)
      localByPath.set(repoPath, { kind: previousType === 'tree' ? 'directory' : 'file', path: repoPath })
      continue
    }

    const resolvedPath = fs.realpathSync(lexicalPath)
    if (!isInside(resolvedRepoRoot, resolvedPath)) throw new Error(`Prompt reference escapes the repository through a symlink: ${raw}`)
    if (resolvedPath === fs.realpathSync(pagePath)) throw new Error(`Page prompt cannot reference itself: ${raw}`)

    const stats = fs.statSync(resolvedPath)
    if (!stats.isFile() && !stats.isDirectory()) throw new Error(`Prompt reference must be a file or directory: ${raw}`)
    const repoPath = normalizeRepoPath(resolvedRepoRoot, resolvedPath)
    localByPath.set(repoPath, { kind: stats.isDirectory() ? 'directory' : 'file', path: repoPath })
  }

  const urls = [...new Set(
    [...prompt.matchAll(URL_REFERENCE_RE)].map((match) => normalizeUrl(match[1]!)),
  )]

  return { local: [...localByPath.values()], urls }
}

export function matchChangedReferences({
  references,
  changedFiles,
  changedUrls,
}: {
  references: PromptReferences
  changedFiles: string[]
  changedUrls: string[]
}) {
  const normalizedFiles = changedFiles.map((file) => file.replace(/^\.\//, '').replaceAll('\\', '/'))
  const normalizedUrls = new Set(changedUrls.map(normalizeUrl))
  const matches = references.local
    .filter((reference) => normalizedFiles.some((file) =>
      reference.kind === 'file'
        ? file === reference.path
        : file === reference.path || file.startsWith(`${reference.path}/`),
    ))
    .map((reference) => reference.path)

  for (const url of references.urls) {
    if (normalizedUrls.has(url)) matches.push(url)
  }
  return matches
}

function runGit(repoRoot: string, args: string[]) {
  return childProcess.execFileSync('git', args, {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

export function findRepoRoot(cwd: string) {
  return runGit(cwd, ['rev-parse', '--show-toplevel']).trim()
}

export function listTrackedFiles(repoRoot: string) {
  return runGit(repoRoot, ['ls-files', '-z'])
    .split('\0')
    .filter(Boolean)
}

function isHolocronSiteConfig(raw: string) {
  let parsed: { name?: string; $schema?: string }
  try {
    parsed = JSON.parse(raw)
  } catch {
    try {
      parsed = JSON.parse(
        raw
          .replace(stringOrCommentRe, '$1')
          .replace(stringOrTrailingCommaRe, '$1'),
      )
    } catch {
      return false
    }
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return false
  if (typeof parsed.name !== 'string' || !parsed.name.trim()) return false
  return typeof parsed.$schema === 'string' && /holocron\.so\/docs\.json/i.test(parsed.$schema)
}

export function discoverMaintainPages(repoRoot: string, baseSha?: string): MaintainPage[] {
  const trackedFiles = listTrackedFiles(repoRoot)
  const siteRoots = [...new Set(
    trackedFiles
      .filter((file) => CONFIG_FILE_NAMES.has(path.posix.basename(file)))
      .filter((file) => {
        try {
          return isHolocronSiteConfig(fs.readFileSync(path.join(repoRoot, file), 'utf8'))
        } catch {
          return false
        }
      })
      .map((file) => path.posix.dirname(file)),
  )]

  return trackedFiles
    .filter((file) => /\.mdx?$/.test(file))
    .map((file) => {
      const siteRoot = siteRoots
        .filter((root) => root === '.' || file.startsWith(`${root}/`))
        .sort((a, b) => b.length - a.length)[0]
      if (!siteRoot) return null
      const absolutePath = path.join(repoRoot, file)
      const frontmatter = parseFrontmatterObject(fs.readFileSync(absolutePath, 'utf8'))
      const promptValue = frontmatter.prompt
      const prompt = typeof promptValue === 'string' && promptValue.trim() ? promptValue : undefined
      if (!prompt && typeof frontmatter.title !== 'string') return null
      const references = prompt
        ? extractPromptReferences({ prompt, pagePath: absolutePath, repoRoot, baseSha })
        : { local: [], urls: [] }
      return { path: file, absolutePath, siteRoot, prompt, references }
    })
    .filter(isTruthy)
}

export function getChangedFiles(repoRoot: string, range?: { from: string; to: string; pullRequest?: boolean }) {
  if (!range) {
    return runGit(repoRoot, ['diff', '--name-only', '--diff-filter=ACMR', 'HEAD'])
      .split('\n')
      .filter(Boolean)
  }
  if (/^0+$/.test(range.from)) {
    return runGit(repoRoot, ['diff-tree', '--root', '--no-commit-id', '--name-only', '-r', range.to])
      .split('\n')
      .filter(Boolean)
  }
  const separator = range.pullRequest ? '...' : '..'
  return runGit(repoRoot, ['diff', '--name-only', '--diff-filter=ACMR', `${range.from}${separator}${range.to}`])
    .split('\n')
    .filter(Boolean)
}

export function getChangedPatches(repoRoot: string, range: { from: string; to: string; pullRequest?: boolean }, files: string[]) {
  if (files.length === 0) return ''
  if (/^0+$/.test(range.from)) {
    return runGit(repoRoot, ['show', '--format=', '--unified=20', range.to, '--', ...files]).slice(0, 300_000)
  }
  const separator = range.pullRequest ? '...' : '..'
  return runGit(repoRoot, ['diff', '--unified=20', `${range.from}${separator}${range.to}`, '--', ...files]).slice(0, 300_000)
}

export function didGenerationPromptChange(repoRoot: string, page: MaintainPage, baseSha: string) {
  const currentPrompt = page.prompt ?? ''
  try {
    const previous = runGit(repoRoot, ['show', `${baseSha}:${page.path}`])
    const previousPrompt = parseFrontmatterObject(previous).prompt
    return currentPrompt !== (typeof previousPrompt === 'string' ? previousPrompt : '')
  } catch {
    return !!currentPrompt
  }
}
