# Changelog

## 2025-01-28 17:30

- Changed upstream connection behavior to reject duplicate connections with WebSocket close code 4009
- Previously: New upstream connections would replace existing ones
- Now: New connections are closed immediately with code 4009 and reason "Upstream already connected"