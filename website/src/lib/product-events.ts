// Server-side product analytics via Strada track().
// Emits OTel logs with event.name + custom.* so `strada analytics events` can query them.
// Never pass prompts, API keys, session tokens, or raw user content.

import { track } from '@strada.sh/sdk'

export type ProductEventName =
  | 'project.created'
  | 'project.deleted'
  | 'org.created'
  | 'deployment.created'
  | 'deployment.live'
  | 'subscription.updated'
  | 'api_key.created'
  | 'chat.turn'
  | 'chat.limit_hit'

export type TrackProperty = string | number | boolean
export type TrackProperties = Record<string, TrackProperty | null | undefined>

export function trackProduct(name: ProductEventName, properties?: TrackProperties): void {
  const props: Record<string, TrackProperty> = {}
  if (properties) {
    for (const [key, value] of Object.entries(properties)) {
      if (value === null || value === undefined) continue
      props[key] = value
    }
  }
  track(name, props)
}
