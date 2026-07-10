// Renders the first-deploy email to tmp/deploy-email.html so it can be
// previewed in a browser (light + dark mode) without sending anything.
// Run: pnpm tsx scripts/preview-deploy-email.ts

import fs from 'node:fs'
import path from 'node:path'
import { buildDeployEmailHtml, buildDeployEmailSubject } from '../src/deploy-email.ts'

const data = {
  githubOwner: 'remorses',
  githubRepo: 'holocron',
  url: 'https://holocron-remorses-site.holocron.so',
  branch: 'main',
}

const html = await buildDeployEmailHtml(data)
const outDir = path.join(import.meta.dirname, '../tmp')
fs.mkdirSync(outDir, { recursive: true })
const outPath = path.join(outDir, 'deploy-email.html')
fs.writeFileSync(outPath, html)
console.log('subject:', buildDeployEmailSubject(data))
console.log('wrote', outPath)
