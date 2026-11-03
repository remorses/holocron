// Tests formatting of OpenCode server logs printed by holocron maintain.
// Session events are covered end to end in maintain.test.ts.

import { stripVTControlCharacters } from 'node:util'
import { describe, expect, test } from 'vitest'
import { formatServerLog } from './maintain-events.ts'

describe('formatServerLog', () => {
  test('drops timestamp, run id and session id, keeps the message and the first line of each field', () => {
    const line = String.raw`timestamp=2026-10-22T16:48:27.248Z level=ERROR run=d8cccb6f message="Failed to drain Session" cause="AI.Error: bad key\n    at bX (/$bunfs/root/chunk-veg17r0c.js:3:3547)\n  [cause]: AI.Error.Authentication: bad key" role=server sessionID=ses_1`
    expect(stripVTControlCharacters(formatServerLog(line))).toMatchInlineSnapshot(`"  opencode ERROR Failed to drain Session cause=AI.Error: bad key"`)
  })
})
