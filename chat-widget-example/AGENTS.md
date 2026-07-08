# Chat Widget Example

Standalone spiceflow app that tests the `ChatWidget` component from `@holocron.so/vite/chat` outside of a holocron docs site. No holocron plugin is used; this is a plain consumer of the chat widget.

## Running

The widget connects to a holocron docs site's `/holocron-api/chat` endpoint. You need a running holocron site for the chat to work.

**Start both servers:**

```bash
# 1. Start the example holocron docs site on port 7664
pnpm --dir example exec vite dev --port 7664

# 2. Start the chat widget example (default port 5173)
pnpm --dir chat-widget-example exec vite dev
```

Then open `http://localhost:5173/` and click the chat bubble.

The `domain` prop in `chat-demo.tsx` is set to `localhost:7664`. Change it to any running holocron site domain (e.g. `holocron.so`) to test against a different backend.

Without a `HOLOCRON_KEY` in the example site's environment, the chat uses a temporary model with lower limits. This is fine for local testing.
