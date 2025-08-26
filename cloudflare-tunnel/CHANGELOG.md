# Changelog

## 2025-01-28 18:20

- Add `Attachment` type for WebSocket attachments with role field
- Use type assertions and `satisfies` operator for attachment type safety
- Ensure all attachment serialization/deserialization is properly typed

## 2025-01-28 18:15

- Replace `any` type with proper `Env` type for environment parameter
- Improve type safety in Durable Object constructor and worker fetch handler

## 2025-01-28 18:10

- Add preview environment configuration to wrangler.jsonc at preview.fumabase.com/_tunnel
- Create comprehensive test suite using vitest and native WebSocket client
- Test upstream-client message exchange, multiple client support, duplicate upstream rejection
- Add test script to package.json

## 2025-01-28 18:00

- Convert to Durable Objects WebSocket hibernation API
- Use `ctx.acceptWebSocket()` for automatic lifecycle management
- Replace in-memory `this.up`/`this.downs` tracking with live socket queries via `ctx.getWebSockets()`
- Tag sockets with role attachments (`{ role: 'up' | 'down' }`) that survive hibernation
- Fix stale upstream connection bugs where `this.up` remained truthy after disconnection
- Move message routing to `webSocketMessage`/`webSocketClose`/`webSocketError` handlers
- Enable automatic DO hibernation during idle periods to reduce costs

## 2025-01-28 17:30

- Changed upstream connection behavior to reject duplicate connections with WebSocket close code 4009
- Previously: New upstream connections would replace existing ones
- Now: New connections are closed immediately with code 4009 and reason "Upstream already connected"