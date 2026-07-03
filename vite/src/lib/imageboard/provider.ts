/**
 * Imageboard virtual tab provider.
 *
 * Implements VirtualTabProvider to generate a single masonry-grid page from
 * a folder of images and videos. Reads the `tab.imageboard` field (a folder
 * path relative to the project root, e.g. `"./public/moodboard"`), walks it
 * recursively, and renders every image/video in an `<ImageboardGrid>`.
 *
 * Sorting: newest first, by last edit time. Filesystem mtimes are useless
 * after `git clone` (every file gets checkout time), so the last git commit
 * time per file is used when available, with mtime as fallback for
 * untracked/dirty files. One `git log` invocation covers the whole folder.
 *
 * Image handling is delegated to the existing MDX enrichment pipeline: the
 * provider emits `<Image src loading="lazy" />` and sync.ts injects
 * width/height/placeholder (sharp + SHA cache) and copies files outside
 * public/ into `/_holocron/images/`. Videos get dimensions from a pure-TS
 * container-header probe (see video-dimensions.ts) and are copied into
 * `/_holocron/media/` when they live outside public/.
 *
 * The generated page uses `mode: custom` so no sidebars render — just the
 * navbar, the grid, and the footer.
 */

import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import type { ConfigNavGroup } from '../../config.ts'
import type { VirtualTabProvider, VirtualTabResult } from '../virtual-tab-provider.ts'
import { buildVirtualPageMdx, virtualPageDir } from '../virtual-page-mdx.ts'
import { logger, formatHolocronWarning } from '../logger.ts'
import { isVideoExtension, probeVideoDimensions } from './video-dimensions.ts'

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg', '.avif'])

const DEFAULT_COLUMNS = 3

type MediaFile = {
  absPath: string
  kind: 'image' | 'video'
  /** Last edit time (ms since epoch) — git commit time or mtime fallback. */
  editTime: number
}

export const imageboardProvider: VirtualTabProvider = {
  name: 'imageboard',
  claims: (tab) => !!tab.imageboard,

  async generate({ tab, projectRoot, pagesDir, publicDir }): Promise<VirtualTabResult> {
    const dir = path.resolve(projectRoot, tab.imageboard!)
    const slug = tab.base ?? path.basename(dir)
    const title = tab.tab || 'Gallery'
    const columns = tab.columns ?? DEFAULT_COLUMNS
    const groups: ConfigNavGroup[] = [{ group: '', pages: [slug] }]

    if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
      logger.warn(
        formatHolocronWarning(
          `imageboard folder "${tab.imageboard}" (tab "${tab.tab}") not found at ${dir}.`,
        ),
      )
      const mdx = buildVirtualPageMdx({
        frontmatter: { title, mode: 'custom' },
        body: [
          '<Warning>',
          '',
          `The imageboard folder \`${tab.imageboard}\` does not exist. Create it and add images or videos.`,
          '',
          '</Warning>',
        ].join('\n'),
      })
      return { groups, mdxContent: { [slug]: mdx } }
    }

    const files = collectMediaFiles(dir)
    applyGitEditTimes({ projectRoot, dir, files })
    files.sort((a, b) => b.editTime - a.editTime || a.absPath.localeCompare(b.absPath))

    const virtualDir = virtualPageDir(pagesDir, slug)
    const entries: string[] = []
    for (const file of files) {
      const entry = renderMediaEntry({ file, publicDir, virtualDir })
      if (entry) entries.push(entry)
    }

    const body =
      entries.length === 0
        ? `No images or videos found in \`${tab.imageboard}\` yet.`
        : [`<ImageboardGrid columns="${columns}">`, '', entries.join('\n\n'), '', '</ImageboardGrid>'].join('\n')

    const mdx = buildVirtualPageMdx({
      frontmatter: {
        title,
        description: `${title} — ${entries.length} items.`,
        mode: 'custom',
      },
      body,
    })

    // Watch the folder itself: the dev server treats directory watch paths
    // as prefixes, so adding/editing/removing any file re-syncs the grid.
    return { groups, mdxContent: { [slug]: mdx }, watchPaths: [dir] }
  },
}

/* ── Folder walk ─────────────────────────────────────────────────────── */

function collectMediaFiles(dir: string): MediaFile[] {
  const files: MediaFile[] = []
  const stack = [dir]
  while (stack.length > 0) {
    const current = stack.pop()!
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (entry.name.startsWith('.')) continue
      const absPath = path.join(current, entry.name)
      if (entry.isDirectory()) {
        stack.push(absPath)
        continue
      }
      if (!entry.isFile()) continue
      const ext = path.extname(entry.name).toLowerCase()
      const kind = IMAGE_EXTENSIONS.has(ext) ? 'image' : isVideoExtension(ext) ? 'video' : undefined
      if (!kind) continue
      // Static string JSX attributes can't represent quotes/newlines safely,
      // and `#`/`?` in filenames break URLs (fragment/query) — the asset
      // resolver also strips them before filesystem lookup. Pathological
      // filenames are skipped with a warning instead of hacking around the
      // MDX serializer / URL encoding.
      if (/["\n\r\\#?]/.test(absPath)) {
        logger.warn(formatHolocronWarning(`imageboard: skipping file with unsupported characters in name: ${absPath}`))
        continue
      }
      files.push({ absPath, kind, editTime: fs.statSync(absPath).mtimeMs })
    }
  }
  return files
}

/* ── Last edit times via git ─────────────────────────────────────────── */

/**
 * Overwrite mtime-based edit times with git last-commit times where known.
 * One `git log` walk over the folder builds a file → newest-commit-time map;
 * untracked or dirty files keep their filesystem mtime.
 */
function applyGitEditTimes({
  projectRoot,
  dir,
  files,
}: {
  projectRoot: string
  dir: string
  files: MediaFile[]
}): void {
  const result = spawnSync(
    'git',
    // `@@` sentinel prevents a filename that is all digits from being
    // mistaken for a timestamp line. --name-only lists the files touched
    // by each commit; the first time a file appears is its newest commit.
    ['log', '--format=@@%ct', '--name-only', '--', path.relative(projectRoot, dir) || '.'],
    { cwd: projectRoot, encoding: 'utf8', maxBuffer: 128 * 1024 * 1024 },
  )
  if (result.status !== 0 || !result.stdout) return

  const commitTimes = new Map<string, number>()
  let currentTime = 0
  for (const line of result.stdout.split('\n')) {
    if (line.startsWith('@@')) {
      currentTime = Number(line.slice(2)) * 1000
      continue
    }
    if (line && !commitTimes.has(line)) {
      commitTimes.set(line, currentTime)
    }
  }

  // Uncommitted modifications should sort by their (real) mtime, so only
  // clean tracked files take the git commit time.
  const dirty = new Set(gitDirtyFiles(projectRoot))
  for (const file of files) {
    const rel = path.relative(projectRoot, file.absPath).replace(/\\/g, '/')
    const commitTime = commitTimes.get(rel)
    if (commitTime && !dirty.has(rel)) {
      file.editTime = commitTime
    }
  }
}

/** Repo-relative paths of files with uncommitted changes (staged or not). */
function gitDirtyFiles(projectRoot: string): string[] {
  const result = spawnSync('git', ['status', '--porcelain'], {
    cwd: projectRoot,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  })
  if (result.status !== 0 || !result.stdout) return []
  return result.stdout
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const entry = line.slice(3)
      // Renames/copies are listed as `R  old -> new`; the dirty file is the
      // NEW path (the old one no longer exists on disk).
      const arrow = entry.indexOf(' -> ')
      const p = arrow === -1 ? entry : entry.slice(arrow + 4)
      return p.replace(/^"|"$/g, '')
    })
}

/* ── MDX entry rendering ─────────────────────────────────────────────── */

function renderMediaEntry({
  file,
  publicDir,
  virtualDir,
}: {
  file: MediaFile
  publicDir: string
  virtualDir: string
}): string | undefined {
  const alt = humanizeFilename(file.absPath)

  if (file.kind === 'image') {
    // Files inside public/ are served at their root-relative URL. Files
    // outside get a relative src that the MDX image pipeline resolves from
    // the virtual page dir and copies into /_holocron/images/. Either way
    // the pipeline injects width/height/placeholder.
    const src = isInside(publicDir, file.absPath)
      ? '/' + path.relative(publicDir, file.absPath).replace(/\\/g, '/')
      : './' + path.relative(virtualDir, file.absPath).replace(/\\/g, '/')
    return `<Image src="${src}" alt="${alt}" loading="lazy" />`
  }

  // Video: the image pipeline doesn't copy or measure videos, so the
  // provider does both — probe dimensions from the container header and
  // copy files outside public/ into /_holocron/media/.
  let src: string
  if (isInside(publicDir, file.absPath)) {
    src = '/' + path.relative(publicDir, file.absPath).replace(/\\/g, '/')
  } else {
    src = copyVideoToPublic({ filePath: file.absPath, publicDir })
  }
  const dims = probeVideoDimensions(file.absPath)
  const dimAttrs = dims ? ` width="${dims.width}" height="${dims.height}"` : ''
  return `<ImageboardVideo src="${src}"${dimAttrs} />`
}

function isInside(parent: string, child: string): boolean {
  const rel = path.relative(parent, child)
  return !!rel && !rel.startsWith('..') && !path.isAbsolute(rel)
}

/** Copy a video into public/_holocron/media/<hash8>-<name> and return its URL. */
function copyVideoToPublic({ filePath, publicDir }: { filePath: string; publicDir: string }): string {
  const buf = fs.readFileSync(filePath)
  const hash = crypto.createHash('sha1').update(buf).digest('hex').slice(0, 8)
  const destName = `${hash}-${path.basename(filePath)}`
  const outputDir = path.join(publicDir, '_holocron', 'media')
  const destPath = path.join(outputDir, destName)
  if (!fs.existsSync(destPath)) {
    fs.mkdirSync(outputDir, { recursive: true })
    fs.writeFileSync(destPath, buf)
  }
  return `/_holocron/media/${destName}`
}

/** "10-call-to-action-examples.jpg" → "10 call to action examples" */
function humanizeFilename(absPath: string): string {
  return path
    .basename(absPath, path.extname(absPath))
    .replace(/[-_]+/g, ' ')
    .trim()
}
