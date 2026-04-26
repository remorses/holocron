// Registers the cloudflare:workers ESM stub loader.
// Usage: node --import ./scripts/register-cf-stub.ts ...
//    or: tsx --import ./scripts/register-cf-stub.ts ...

import { register } from 'node:module'

register('./cf-loader.ts', import.meta.url)
