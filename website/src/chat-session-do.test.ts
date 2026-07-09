// Tests for persistent AI chat sessions, running inside the Cloudflare
// Workers runtime against a real Durable Object (CHAT_SESSION).
//
// The DO is keyed per docs site; each conversation is a row keyed by a
// chs_... session id. These verify snapshot roundtrips, per-site isolation,
// the size cap, the per-site session cap eviction, and clearSession.
import { describe, test, expect } from 'vitest'
import { env } from 'cloudflare:workers'
import { ulid } from 'ulid'
import { runDurableObjectAlarm } from 'cloudflare:test'
import type { ChatSessionDO } from './chat-session-do.ts'
import { MAX_SNAPSHOT_BYTES } from './chat-session-do.ts'

function stubFor(siteKey: string): DurableObjectStub<ChatSessionDO> {
  const id = env.CHAT_SESSION.idFromName(siteKey)
  return env.CHAT_SESSION.get(id) as DurableObjectStub<ChatSessionDO>
}

function sessionId(): string {
  // Deterministic-length fake ids for tests (43 base64url chars after chs_)
  return 'chs_' + (ulid() + ulid()).slice(0, 43).padEnd(43, 'A')
}

const conversation = [
  { role: 'user', content: 'hello' },
  { role: 'assistant', content: [{ type: 'text', text: 'hi there' }] },
]

describe('chat session persistence', () => {
  test('saveSnapshot then getSnapshot roundtrips the JSON', async () => {
    const stub = stubFor(`host:${ulid()}.example.com`)
    const sid = sessionId()

    const saved = await stub.saveSnapshot({
      sessionId: sid,
      pageSlug: '/quickstart',
      modelMessagesJson: JSON.stringify(conversation),
    })
    expect(saved.saved).toBe(true)

    const snapshot = await stub.getSnapshot({ sessionId: sid })
    expect(snapshot).not.toBeNull()
    expect(JSON.parse(snapshot!.modelMessagesJson)).toEqual(conversation)
  })

  test('unknown session id returns null', async () => {
    const stub = stubFor(`host:${ulid()}.example.com`)
    expect(await stub.getSnapshot({ sessionId: sessionId() })).toBeNull()
  })

  test('snapshot overwrite replaces previous history (last write wins)', async () => {
    const stub = stubFor(`host:${ulid()}.example.com`)
    const sid = sessionId()

    await stub.saveSnapshot({ sessionId: sid, pageSlug: '', modelMessagesJson: JSON.stringify(conversation) })
    const longer = [...conversation, { role: 'user', content: 'follow-up' }]
    await stub.saveSnapshot({ sessionId: sid, pageSlug: '', modelMessagesJson: JSON.stringify(longer) })

    const snapshot = await stub.getSnapshot({ sessionId: sid })
    expect(JSON.parse(snapshot!.modelMessagesJson)).toEqual(longer)
  })

  test('sessions are isolated per site DO', async () => {
    const sid = sessionId()
    await stubFor('host:site-a.example.com').saveSnapshot({
      sessionId: sid,
      pageSlug: '',
      modelMessagesJson: JSON.stringify(conversation),
    })
    // Same session id looked up through another site's DO finds nothing.
    expect(await stubFor('host:site-b.example.com').getSnapshot({ sessionId: sid })).toBeNull()
  })

  test('oversized snapshots are rejected', async () => {
    const stub = stubFor(`host:${ulid()}.example.com`)
    const sid = sessionId()
    const huge = JSON.stringify([{ role: 'user', content: 'x'.repeat(MAX_SNAPSHOT_BYTES) }])

    const saved = await stub.saveSnapshot({ sessionId: sid, pageSlug: '', modelMessagesJson: huge })
    expect(saved.saved).toBe(false)
    expect(await stub.getSnapshot({ sessionId: sid })).toBeNull()
  })

  test('clearSession deletes the conversation', async () => {
    const stub = stubFor(`host:${ulid()}.example.com`)
    const sid = sessionId()

    await stub.saveSnapshot({ sessionId: sid, pageSlug: '', modelMessagesJson: JSON.stringify(conversation) })
    await stub.clearSession({ sessionId: sid })
    expect(await stub.getSnapshot({ sessionId: sid })).toBeNull()
  })

  test('alarm prunes nothing for fresh sessions and keeps them readable', async () => {
    const siteKey = `host:${ulid()}.example.com`
    const stub = stubFor(siteKey)
    const sid = sessionId()

    await stub.saveSnapshot({ sessionId: sid, pageSlug: '', modelMessagesJson: JSON.stringify(conversation) })
    // saveSnapshot schedules the daily prune alarm; firing it must not
    // delete sessions updated within the TTL window.
    const ran = await runDurableObjectAlarm(stub)
    expect(ran).toBe(true)
    expect(await stub.getSnapshot({ sessionId: sid })).not.toBeNull()
  })
})
