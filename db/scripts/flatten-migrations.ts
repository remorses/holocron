// Flatten drizzle-kit migrations for wrangler D1 compatibility.
//
// Drizzle-kit generates migrations as `<timestamp>_<name>/migration.sql`
// subdirectories, but wrangler D1 only recognizes flat `.sql` files.
// This script scans a migrations directory, finds any subdirectory that
// contains a `migration.sql` but has no corresponding flat `.sql` file,
// and copies it out with sequential numbering (0001_, 0002_, ...).
//
// Tracking issues:
//   https://github.com/drizzle-team/drizzle-orm/issues/5266 (--flat flag request)
//   https://github.com/cloudflare/workers-sdk/issues/13257 (wrangler subdirectory support)
// TODO: Remove this script when drizzle-kit adds a --flat flag or wrangler supports subdirectories.
//
// Usage: tsx db/scripts/flatten-migrations.ts <migrations-dir>
// Example: tsx db/scripts/flatten-migrations.ts db/drizzle

import fs from 'node:fs'
import path from 'node:path'

function flattenMigrations(migrationsDir: string) {
  const absDir = path.resolve(migrationsDir)
  if (!fs.existsSync(absDir)) {
    console.error(`Directory not found: ${absDir}`)
    process.exit(1)
  }

  const entries = fs.readdirSync(absDir, { withFileTypes: true })

  // Collect existing flat SQL files to find the highest sequence number
  const flatFiles = entries
    .filter((e) => e.isFile() && e.name.endsWith('.sql'))
    .map((e) => e.name)
    .sort()

  let nextSeq = 1
  for (const name of flatFiles) {
    const match = name.match(/^(\d+)_/)
    if (match) {
      const num = parseInt(match[1]!, 10)
      if (num >= nextSeq) nextSeq = num + 1
    }
  }

  // Collect subdirectories that have a migration.sql
  const subdirs = entries
    .filter((e) => e.isDirectory() && fs.existsSync(path.join(absDir, e.name, 'migration.sql')))
    .map((e) => e.name)
    .sort()

  // Build a set of subdirectory names that already have a flat counterpart.
  // We match by checking if any flat file's content is identical to the
  // subdirectory's migration.sql (handles renames). Also check by name suffix.
  const flatContents = new Map<string, string>()
  for (const name of flatFiles) {
    flatContents.set(name, fs.readFileSync(path.join(absDir, name), 'utf-8'))
  }

  let created = 0
  for (const subdir of subdirs) {
    const migrationPath = path.join(absDir, subdir, 'migration.sql')
    const migrationContent = fs.readFileSync(migrationPath, 'utf-8')

    // Check if any existing flat file has identical content
    let alreadyFlattened = false
    for (const [, content] of flatContents) {
      if (content === migrationContent) {
        alreadyFlattened = true
        break
      }
    }

    if (alreadyFlattened) continue

    // Extract a slug from the subdirectory name (remove timestamp prefix)
    const slug = subdir.replace(/^\d+_/, '')

    // Guard: if a flat file with the same slug exists but different content,
    // the migration was edited after flattening. Fail loudly instead of
    // creating a duplicate that wrangler would apply as a second migration.
    const existingSameSlug = flatFiles.find((name) => name.replace(/^\d+_/, '').replace(/\.sql$/, '') === slug)
    if (existingSameSlug) {
      console.error(`Error: ${subdir}/migration.sql changed after flattening. Existing flat file: ${existingSameSlug}`)
      console.error('Delete the stale flat file and re-run, or regenerate the migration.')
      process.exit(1)
    }

    const seqStr = String(nextSeq).padStart(4, '0')
    const flatName = `${seqStr}_${slug}.sql`
    const flatPath = path.join(absDir, flatName)

    fs.copyFileSync(migrationPath, flatPath)
    console.log(`Created ${flatName}`)
    flatContents.set(flatName, migrationContent)
    nextSeq++
    created++
  }

  if (created === 0) {
    console.log('All migrations already flattened, nothing to do.')
  } else {
    console.log(`Flattened ${created} migration(s).`)
  }
}

// Support pnpm passthrough: `pnpm run flatten -- ../provider/drizzle`
// produces argv like ["./drizzle", "--", "../provider/drizzle"].
// Use the last non-"--" argument as the directory.
const args = process.argv.slice(2).filter((a) => a !== '--')
const dir = args.at(-1)
if (!dir) {
  console.error('Usage: tsx db/scripts/flatten-migrations.ts <migrations-dir>')
  process.exit(1)
}

console.log(`Scanning ${path.resolve(dir)}`)
flattenMigrations(dir)
