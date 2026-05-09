#!/usr/bin/env node

// Thin bin entrypoint: re-exports the Holocron CLI so installing
// @holocron.so/vite also provides the `holocron` command.

import { cli } from '@holocron.so/cli'

cli.parse()
