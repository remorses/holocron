#!/usr/bin/env node

// Executable entrypoint for the Holocron CLI. Parses argv and delegates to cli.ts.
// Loads .env before anything runs so HOLOCRON_KEY from OIDC flow is available.

import 'dotenv/config'
import { cli } from './cli.ts'

cli.parse()
