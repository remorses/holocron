// Client-side function for saving config overrides to the holocron.so DO.
//
// NOT a server action. Runs on the client to avoid the spiceflow auto-refresh
// race condition: server actions refresh with OLD cookies before the client
// can set the new cookie. Instead, the client POSTs directly, sets the cookie,
// then explicitly reloads the page.

import type { ConfigOverride } from './config-override.ts'

// TODO: revert to 'https://holocron.so' after testing
const OVERRIDE_API_BASE = 'https://preview.holocron.so'

/** Save a config override to the holocron.so DO. Returns the key
 *  that the client should store in a cookie. Reuses the existing DO
 *  if a cookie is already present. */
export async function saveConfigOverride(
  override: ConfigOverride,
  existingDoId?: string,
): Promise<{ key: string }> {
  const res = await fetch(`${OVERRIDE_API_BASE}/api/config-override`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ override, doId: existingDoId }),
  })

  if (!res.ok) {
    throw new Error(`Failed to save config override: ${res.status}`)
  }

  return (await res.json()) as { key: string }
}
