// Stripe webhook route. Mounted on the root app in server.tsx.
//
// Stripe sends raw POST bodies with a signature header, so the handler reads
// request.text() (NEVER request.json() and NEVER a zod body schema — either
// would consume/normalize the stream and break HMAC verification) and verifies
// it with constructEventAsync (the async variant works in Workers where the
// sync crypto path is unavailable).

import { Spiceflow } from 'spiceflow'
import * as errore from 'errore'
import { env } from 'cloudflare:workers'
import { getStripe, handleSubscriptionChange } from './stripe.ts'

export class WebhookSignatureError extends errore.createTaggedError({
  name: 'WebhookSignatureError',
  message: 'Stripe webhook signature verification failed',
}) {}

export const stripeWebhookApp = new Spiceflow()
  .route({
    method: 'POST',
    path: '/api/stripe/webhook',
    async handler({ request }) {
      const sig = request.headers.get('stripe-signature')
      if (!sig) return new Response('No signature', { status: 400 })

      // Read the raw body exactly once, before any other parsing.
      const rawBody = await request.text()

      const stripe = getStripe()
      const event = await stripe.webhooks
        .constructEventAsync(rawBody, sig, env.STRIPE_WEBHOOK_SECRET)
        .catch((e) => new WebhookSignatureError({ cause: e }))
      if (event instanceof Error) {
        console.warn('[stripe] webhook signature verification failed:', event.message)
        return new Response('Bad signature', { status: 400 })
      }

      const result = await (async () => {
        if (
          event.type === 'customer.subscription.created' ||
          event.type === 'customer.subscription.updated' ||
          event.type === 'customer.subscription.deleted'
        ) {
          return handleSubscriptionChange(event.data.object)
        }
        return null // unhandled event type — ignore silently
      })()

      if (result instanceof Error) {
        console.error(`[stripe] webhook ${event.type} failed:`, result.message)
        return new Response('Webhook handler failed', { status: 500 })
      }

      return new Response('ok', { status: 200 })
    },
  })
