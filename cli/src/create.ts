// Scaffold a new Holocron documentation site.
//
// Prompts for project name, optionally authenticates with holocron.so
// via device flow, creates a project + API key, then copies the template
// files and writes .env + .gitignore + package.json.
//
// The template lives in dist/template/ (copied from template/ at build time
// by scripts/copy-template.ts). We modify docs.json name + schema URL,
// and generate a fresh package.json with published @holocron.so/vite.
//
// Git metadata is NOT sent during scaffold because cwd is often a parent
// repo, not the new docs repo. The vite plugin register step sends the
// correct git info from the actual project root on first dev/build.

import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'
import * as clack from '@clack/prompts'
import { goke, isAgent } from 'goke'
import { loginWithDeviceFlow } from './device-flow.ts'
import { createSessionClient } from './api-client.ts'
import { getBaseUrl } from './config.ts'

// Template lives in dist/template/ after build. When running from src/ via tsx,
// resolve relative to the package root's dist/ instead.
const TEMPLATE_DIR = fs.existsSync(path.resolve(import.meta.dirname, 'template'))
  ? path.resolve(import.meta.dirname, 'template')
  : path.resolve(import.meta.dirname, '..', 'dist', 'template')

export const createCli = goke()

createCli
  .command('create [dir]', 'Scaffold a new Holocron docs site')
  .option('--name <name>', 'Project/company name')
  .option('--skip-auth', 'Skip authentication and cloud setup')
  .option('--skip-install', 'Skip dependency installation')
  .action(async (dir, options, { process: proc }) => {
    let name = options.name
    if (!name) {
      if (isAgent || !process.stdin.isTTY) {
        console.error('Missing --name. Usage: holocron create --name "My Docs" [dir]')
        proc.exit(1)
        return
      }
      const prompted = await clack.text({
        message: 'What is your project/company name?',
        placeholder: 'My Docs',
        validate: (v) => (!v || v.length === 0 ? 'Name is required' : undefined),
      })
      if (clack.isCancel(prompted)) {
        console.log('Cancelled.')
        proc.exit(0)
        return
      }
      name = prompted
    }

    await scaffold({
      dir: dir || name.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
      name,
      skipAuth: !!options.skipAuth,
      skipInstall: !!options.skipInstall,
      baseUrl: getBaseUrl(),
    })
  })

// ── Scaffold logic ──────────────────────────────────────────────────

interface ScaffoldOptions {
  dir: string
  name: string
  skipAuth: boolean
  skipInstall: boolean
  baseUrl: string
}

interface CloudSetupResult {
  holocronKey: string
  baseUrl: string
}

async function setupCloud(options: {
  baseUrl: string
  projectName: string
  exit: (code: number) => never
}): Promise<CloudSetupResult> {
  const { baseUrl, projectName, exit } = options

  // 1. Device flow login
  const { accessToken } = await loginWithDeviceFlow({ baseUrl, exit })
  const { safeFetch } = createSessionClient(baseUrl, accessToken)

  // 2. Create project (org auto-created server-side if needed)
  const project = await safeFetch('/api/v0/projects', {
    method: 'POST',
    body: { name: projectName },
  })
  if (project instanceof Error) {
    clack.log.error(`Failed to create project: ${project.message}`)
    return exit(1)
  }

  // 3. Create API key scoped to this project
  const key = await safeFetch('/api/v0/keys', {
    method: 'POST',
    body: { name: 'default', projectId: project.projectId },
  })
  if (key instanceof Error) {
    clack.log.error(`Failed to create API key: ${key.message}`)
    return exit(1)
  }

  return { holocronKey: key.key, baseUrl }
}

function detectPackageManager(): string {
  const cwd = process.cwd()
  if (fs.existsSync(path.join(cwd, 'bun.lock'))) return 'bun'
  if (fs.existsSync(path.join(cwd, 'pnpm-lock.yaml'))) return 'pnpm'
  if (fs.existsSync(path.join(cwd, 'yarn.lock'))) return 'yarn'
  try {
    execSync('pnpm --version', { stdio: 'pipe' })
    return 'pnpm'
  } catch {
    return 'npm'
  }
}

function copyDir(src: string, dest: string) {
  fs.mkdirSync(dest, { recursive: true })
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name)
    const destPath = path.join(dest, entry.name)
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath)
    } else {
      fs.copyFileSync(srcPath, destPath)
    }
  }
}

async function scaffold(options: ScaffoldOptions) {
  const { dir, name, skipAuth, skipInstall, baseUrl } = options
  const targetDir = path.resolve(dir)
  const nonInteractive = isAgent || !process.stdin.isTTY

  clack.intro('Holocron — Create')

  // 1. Cloud setup (login + project + API key)
  let cloud: CloudSetupResult | null = null
  if (!skipAuth) {
    if (nonInteractive) {
      clack.log.info('Non-interactive mode: skipping cloud setup. Set HOLOCRON_KEY manually.')
    } else {
      const shouldAuth = await clack.confirm({
        message: 'Connect to holocron.so for AI chat and analytics?',
        initialValue: true,
      })
      if (clack.isCancel(shouldAuth)) {
        clack.cancel('Cancelled.')
        process.exit(0)
      }
      if (shouldAuth) {
        cloud = await setupCloud({
          baseUrl,
          projectName: name,
          exit: (code) => process.exit(code),
        })
      }
    }
  }

  // 2. Copy template files
  clack.log.step('Copying template files...')
  if (!fs.existsSync(TEMPLATE_DIR)) {
    clack.log.error('Template not found. The package may not be built correctly.')
    process.exit(1)
  }
  copyDir(TEMPLATE_DIR, targetDir)

  // 3. Update docs.json with project name
  const docsJsonPath = path.join(targetDir, 'docs.json')
  if (fs.existsSync(docsJsonPath)) {
    const docsJson = JSON.parse(fs.readFileSync(docsJsonPath, 'utf-8'))
    docsJson.name = name
    docsJson.$schema = 'https://unpkg.com/@holocron.so/vite/src/schema.json'
    fs.writeFileSync(docsJsonPath, JSON.stringify(docsJson, null, 2) + '\n')
  }

  // 4. Write package.json
  const packageJson = {
    name: name.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
    private: true,
    type: 'module',
    scripts: {
      dev: 'vite dev',
      build: 'vite build',
      start: 'node dist/rsc/index.js',
    },
    dependencies: {
      '@holocron.so/vite': 'latest',
      react: '^19.2.5',
      'react-dom': '^19.2.5',
      spiceflow: '1.23.1-rsc.0',
      vite: '^8.0.10',
    },
    devDependencies: {
      '@types/react': '^19.2.7',
      '@types/react-dom': '^19.2.3',
      typescript: '^5.9.3',
    },
  }
  fs.writeFileSync(
    path.join(targetDir, 'package.json'),
    JSON.stringify(packageJson, null, 2) + '\n',
  )

  // 5. Write .env with cloud credentials
  if (cloud) {
    const envLines = [
      `HOLOCRON_KEY=${cloud.holocronKey}`,
    ]
    if (cloud.baseUrl !== 'https://holocron.so') {
      envLines.push(`HOLOCRON_API_URL=${cloud.baseUrl}`)
    }
    envLines.push('')
    fs.writeFileSync(path.join(targetDir, '.env'), envLines.join('\n'))
    clack.log.success('Wrote .env with API key')
  }

  // 6. Write .gitignore
  const gitignore = [
    '.env',
    'node_modules',
    'dist',
    '.vite',
    '*.tsbuildinfo',
    '',
  ].join('\n')
  fs.writeFileSync(path.join(targetDir, '.gitignore'), gitignore)

  clack.log.success(`Project scaffolded in ${path.relative(process.cwd(), targetDir) || '.'}`)

  // 7. Install dependencies
  const pm = detectPackageManager()
  if (!skipInstall) {
    const shouldInstall = nonInteractive
      ? true
      : await clack.confirm({
          message: `Install dependencies with ${pm}?`,
          initialValue: true,
        })
    if (!clack.isCancel(shouldInstall) && shouldInstall) {
      const spinner = clack.spinner()
      spinner.start(`Running ${pm} install...`)
      try {
        execSync(`${pm} install`, { cwd: targetDir, stdio: 'pipe' })
        spinner.stop(`Dependencies installed with ${pm}`)
      } catch {
        spinner.stop(`${pm} install failed`)
        clack.log.warn(`Run \`${pm} install\` manually in ${targetDir}`)
      }
    }
  }

  // 8. Offer to start dev server (skip in non-interactive mode)
  if (!nonInteractive) {
    const shouldDev = await clack.confirm({
      message: 'Start development server?',
      initialValue: false,
    })
    if (!clack.isCancel(shouldDev) && shouldDev) {
      clack.log.info('Starting dev server...')
      execSync(`${pm} run dev`, { cwd: targetDir, stdio: 'inherit' })
      return
    }
  }
  clack.log.info(`Run \`${pm} run dev\` to start the dev server.`)

  if (cloud) {
    clack.log.info('Visit https://holocron.so/dashboard to manage AI chat and analytics.')
  }

  clack.outro('Done!')
}
