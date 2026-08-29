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
  promptError?: string
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
      localByPath.set(repoPath, {
        kind: previousType === 'tree' || (previousType !== 'blob' && raw.endsWith('/')) ? 'directory' : 'file',
        path: repoPath,
      })
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

export function hasMissingLocalReferences(repoRoot: string, references: PromptReferences) {
  return references.local.some((reference) => !fs.existsSync(path.join(repoRoot, reference.path)))
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

const GIT_TIMEOUT_MS = 30_000
const GIT_PATCH_TIMEOUT_MS = 60_000
const GIT_MAX_BUFFER = 256 * 1024 * 1024
const GIT_PATH_CHUNK = 50
const GIT_PREFIX = [
  '--no-pager',
  '--literal-pathspecs',
  '-c', 'core.quotepath=false',
  '-c', 'color.ui=never',
]
const GIT_DIFF_FLAGS = ['--no-ext-diff', '--no-textconv', '--no-color']
const GIT_ENV = {
  ...process.env,
  GIT_TERMINAL_PROMPT: '0',
  GIT_OPTIONAL_LOCKS: '0',
  GIT_PAGER: '',
  PAGER: '',
}

// execFileSync only, never a shell. Path lists always use -z. Porcelain v1
// `entry.slice(3)` breaks on rename records. --no-ext-diff blocks GIT_EXTERNAL_DIFF
// (difftastic). Critique uses the same pattern in cli/src/diff-utils.ts.
function gitExecOptions(repoRoot: string, timeout: number) {
  return {
    cwd: repoRoot,
    encoding: 'utf8' as const,
    stdio: ['ignore', 'pipe', 'pipe'] as ['ignore', 'pipe', 'pipe'],
    timeout,
    maxBuffer: GIT_MAX_BUFFER,
    killSignal: 'SIGKILL' as const,
    windowsHide: true,
    env: GIT_ENV,
  }
}

function runGit(repoRoot: string, args: string[]) {
  return childProcess.execFileSync('git', [...GIT_PREFIX, ...args], gitExecOptions(repoRoot, GIT_TIMEOUT_MS))
}

function runGitPatch(repoRoot: string, args: string[]) {
  return childProcess.execFileSync('git', [...GIT_PREFIX, ...args], gitExecOptions(repoRoot, GIT_PATCH_TIMEOUT_MS))
}

function parseNulPaths(output: string) {
  return output
    .split('\0')
    .filter(Boolean)
    .map((file) => file.replace(/^\.\//, '').replaceAll('\\', '/'))
}

export function findRepoRoot(cwd: string) {
  return runGit(cwd, ['rev-parse', '--show-toplevel']).trim()
}

export function listTrackedFiles(repoRoot: string) {
  return parseNulPaths(runGit(repoRoot, ['ls-files', '-z']))
}

function listGitlinkPaths(repoRoot: string) {
  try {
    const paths: string[] = []
    for (const entry of runGit(repoRoot, ['ls-files', '-s', '-z']).split('\0').filter(Boolean)) {
      if (!entry.startsWith('160000 ')) continue
      const tab = entry.indexOf('\t')
      if (tab === -1) continue
      paths.push(entry.slice(tab + 1).replace(/^\.\//, '').replaceAll('\\', '/'))
    }
    return paths
  } catch {
    return []
  }
}

function isInitializedSubmodule(repoRoot: string, subPath: string) {
  return fs.existsSync(path.join(repoRoot, subPath, '.git'))
}

function prefixSubmodulePath(subPath: string, inner: string) {
  return `${subPath}/${inner}`
}

function gitLinkSha({ repoRoot, commit, subPath }: { repoRoot: string; commit: string; subPath: string }) {
  try {
    return runGit(repoRoot, ['rev-parse', '--verify', `${commit}:${subPath}`]).trim()
  } catch {
    return undefined
  }
}

function resolveRangeEnds(repoRoot: string, range: { from: string; to: string; pullRequest?: boolean }) {
  if (/^0+$/.test(range.from)) return undefined
  if (range.pullRequest) {
    try {
      return { from: runGit(repoRoot, ['merge-base', range.from, range.to]).trim(), to: range.to }
    } catch {
      return { from: range.from, to: range.to }
    }
  }
  return { from: range.from, to: range.to }
}

// Parent `git diff --name-only` reports the gitlink (`template`), not inner files.
// Run git inside each initialized submodule and prefix paths from the parent root.
function listSubmoduleInnerChanges({
  repoRoot,
  subPath,
  range,
}: {
  repoRoot: string
  subPath: string
  range?: { from: string; to: string; pullRequest?: boolean }
}) {
  const abs = path.join(repoRoot, subPath)
  if (!isInitializedSubmodule(repoRoot, subPath)) return []
  try {
    if (!range) {
      return parseNulPaths(runGit(abs, ['diff', ...GIT_DIFF_FLAGS, '--name-only', '-z', 'HEAD']))
        .map((file) => prefixSubmodulePath(subPath, file))
    }
    const ends = resolveRangeEnds(repoRoot, range)
    if (!ends) return []
    const fromSha = gitLinkSha({ repoRoot, commit: ends.from, subPath })
    const toSha = gitLinkSha({ repoRoot, commit: ends.to, subPath })
    if (!fromSha && toSha) {
      return parseNulPaths(runGit(abs, ['ls-tree', '-r', '-z', '--name-only', toSha]))
        .map((file) => prefixSubmodulePath(subPath, file))
    }
    if (fromSha && !toSha) {
      return parseNulPaths(runGit(abs, ['ls-tree', '-r', '-z', '--name-only', fromSha]))
        .map((file) => prefixSubmodulePath(subPath, file))
    }
    if (!fromSha || !toSha || fromSha === toSha) return []
    return parseNulPaths(runGit(abs, ['diff', ...GIT_DIFF_FLAGS, '--name-only', '-z', `${fromSha}..${toSha}`]))
      .map((file) => prefixSubmodulePath(subPath, file))
  } catch {
    return []
  }
}

function listSubmoduleInnerWorkingTree(repoRoot: string, subPath: string) {
  const abs = path.join(repoRoot, subPath)
  if (!isInitializedSubmodule(repoRoot, subPath)) return []
  try {
    const tracked = parseNulPaths(runGit(abs, ['diff', ...GIT_DIFF_FLAGS, '--name-only', '-z', 'HEAD']))
    const untracked = parseNulPaths(runGit(abs, ['ls-files', '-z', '--others', '--exclude-standard']))
    return [...new Set([...tracked, ...untracked])].map((file) => prefixSubmodulePath(subPath, file))
  } catch {
    return []
  }
}

function expandSubmoduleChangedFiles({
  repoRoot,
  parentFiles,
  range,
}: {
  repoRoot: string
  parentFiles: string[]
  range?: { from: string; to: string; pullRequest?: boolean }
}) {
  const gitlinks = listGitlinkPaths(repoRoot)
  const gitlinkSet = new Set(gitlinks)
  const expanded = parentFiles.filter((file) => !gitlinkSet.has(file))
  const toScan = range ? gitlinks.filter((sub) => parentFiles.includes(sub)) : gitlinks
  for (const sub of toScan) {
    const inner = listSubmoduleInnerChanges({ repoRoot, subPath: sub, range })
    if (inner.length > 0) expanded.push(...inner)
    else if (parentFiles.includes(sub) && !isInitializedSubmodule(repoRoot, sub)) expanded.push(sub)
  }
  return [...new Set(expanded)]
}

function matchGitlink(file: string, gitlinks: string[]) {
  return [...gitlinks].sort((a, b) => b.length - a.length).find((sub) => file === sub || file.startsWith(`${sub}/`))
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
      try {
        const references = prompt
          ? extractPromptReferences({ prompt, pagePath: absolutePath, repoRoot, baseSha })
          : { local: [], urls: [] }
        return { path: file, absolutePath, siteRoot, prompt, references }
      } catch (error) {
        return {
          path: file,
          absolutePath,
          siteRoot,
          prompt,
          references: { local: [], urls: [] },
          promptError: error instanceof Error ? error.message : String(error),
        }
      }
    })
    .filter(isTruthy)
}

export function getChangedFiles(repoRoot: string, range?: { from: string; to: string; pullRequest?: boolean }) {
  let parentFiles: string[]
  if (!range) {
    parentFiles = parseNulPaths(runGit(repoRoot, ['diff', ...GIT_DIFF_FLAGS, '--name-only', '-z', 'HEAD']))
  } else if (/^0+$/.test(range.from)) {
    parentFiles = parseNulPaths(runGit(repoRoot, ['diff-tree', ...GIT_DIFF_FLAGS, '--root', '--no-commit-id', '--name-only', '-r', '-z', range.to]))
  } else {
    const separator = range.pullRequest ? '...' : '..'
    parentFiles = parseNulPaths(runGit(repoRoot, ['diff', ...GIT_DIFF_FLAGS, '--name-only', '-z', `${range.from}${separator}${range.to}`]))
  }
  return expandSubmoduleChangedFiles({ repoRoot, parentFiles, range })
}

export function getWorkingTreeChanges(repoRoot: string) {
  const gitlinks = listGitlinkPaths(repoRoot)
  const gitlinkSet = new Set(gitlinks)
  const tracked = parseNulPaths(runGit(repoRoot, ['diff', ...GIT_DIFF_FLAGS, '--name-only', '-z', 'HEAD']))
    .filter((file) => !gitlinkSet.has(file))
  const untracked = parseNulPaths(runGit(repoRoot, ['ls-files', '-z', '--others', '--exclude-standard']))
    .filter((file) => !gitlinkSet.has(file))
  const inner = gitlinks.flatMap((sub) => listSubmoduleInnerWorkingTree(repoRoot, sub))
  return [...new Set([...tracked, ...untracked, ...inner])]
}

export function getHeadSha(repoRoot: string) {
  return runGit(repoRoot, ['rev-parse', 'HEAD']).trim()
}

export function getCurrentBranch(repoRoot: string) {
  return runGit(repoRoot, ['branch', '--show-current']).trim() || 'main'
}

export function getChangedPatches(repoRoot: string, range: { from: string; to: string; pullRequest?: boolean }, files: string[]) {
  if (files.length === 0) return ''
  const gitlinks = listGitlinkPaths(repoRoot)
  const parentFiles: string[] = []
  const innerBySub = new Map<string, string[]>()
  for (const file of files) {
    const sub = matchGitlink(file, gitlinks)
    if (sub && file.startsWith(`${sub}/`)) {
      const inner = innerBySub.get(sub) ?? []
      inner.push(file.slice(sub.length + 1))
      innerBySub.set(sub, inner)
      continue
    }
    parentFiles.push(file)
  }

  const patches: string[] = []
  for (let i = 0; i < parentFiles.length; i += GIT_PATH_CHUNK) {
    const chunk = parentFiles.slice(i, i + GIT_PATH_CHUNK)
    if (/^0+$/.test(range.from)) {
      patches.push(runGitPatch(repoRoot, ['show', ...GIT_DIFF_FLAGS, '--format=', '--unified=20', range.to, '--', ...chunk]))
      continue
    }
    const separator = range.pullRequest ? '...' : '..'
    patches.push(runGitPatch(repoRoot, ['diff', ...GIT_DIFF_FLAGS, '--unified=20', `${range.from}${separator}${range.to}`, '--', ...chunk]))
  }

  const ends = resolveRangeEnds(repoRoot, range)
  for (const [sub, inner] of innerBySub) {
    if (!isInitializedSubmodule(repoRoot, sub) || !ends) continue
    const fromSha = gitLinkSha({ repoRoot, commit: ends.from, subPath: sub })
    const toSha = gitLinkSha({ repoRoot, commit: ends.to, subPath: sub })
    if (!fromSha || !toSha || fromSha === toSha) continue
    const abs = path.join(repoRoot, sub)
    for (let i = 0; i < inner.length; i += GIT_PATH_CHUNK) {
      const chunk = inner.slice(i, i + GIT_PATH_CHUNK)
      patches.push(runGitPatch(abs, [
        'diff',
        ...GIT_DIFF_FLAGS,
        `--src-prefix=a/${sub}/`,
        `--dst-prefix=b/${sub}/`,
        '--unified=20',
        `${fromSha}..${toSha}`,
        '--',
        ...chunk,
      ]))
    }
  }
  return patches.join('').slice(0, 300_000)
}

export function didGenerationPromptChange(repoRoot: string, page: MaintainPage, baseSha: string) {
  const currentPrompt = page.prompt ?? ''
  try {
    const previous = runGit(repoRoot, ['show', '--no-textconv', `${baseSha}:${page.path}`])
    const previousPrompt = parseFrontmatterObject(previous).prompt
    return currentPrompt !== (typeof previousPrompt === 'string' ? previousPrompt : '')
  } catch {
    return !!currentPrompt
  }
}
