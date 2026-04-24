#!/usr/bin/env node

// Executable entrypoint for the Holocron CLI. Parses argv and delegates to cli.ts.

import { cli } from './cli.ts'

cli.parse()
