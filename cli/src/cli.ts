// Main Holocron CLI entrypoint. Composes sub-CLIs and wires help/version output.

import { goke } from 'goke'
import packageJson from '../package.json' with { type: 'json' }
import { loginCli } from './login.ts'
import { keysCli } from './keys.ts'
import { projectsCli } from './projects.ts'
import { createCli } from './create.ts'

export const cli = goke('holocron')
  .use(loginCli)
  .use(keysCli)
  .use(projectsCli)
  .use(createCli)

cli.help()
cli.version(packageJson.version)
