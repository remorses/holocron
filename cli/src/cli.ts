// Main Holocron CLI entrypoint. Composes sub-CLIs and wires help/version output.
// Global --api-url flag sets process.env.HOLOCRON_API_URL so all commands
// (login, deploy, keys, projects, etc.) pick it up via getBaseUrl().

import { goke } from 'goke'
import packageJson from '../package.json' with { type: 'json' }
import { loginCli } from './login.ts'
import { keysCli } from './keys.ts'
import { projectsCli } from './projects.ts'
import { createCli } from './create.ts'
import { deployCli } from './deploy.ts'

export const cli = goke('holocron')
  .option('--api-url [url]', 'Holocron API URL (default: https://holocron.so)')
  .use((options) => {
    if (options.apiUrl) {
      process.env.HOLOCRON_API_URL = options.apiUrl
    }
  })
  .use(loginCli)
  .use(keysCli)
  .use(projectsCli)
  .use(createCli)
  .use(deployCli)

cli.help()
cli.version(packageJson.version)
