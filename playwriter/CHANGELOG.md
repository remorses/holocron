# Changelog

## 2025-07-24 21:30

- Moved profile listing functionality into connect tool when emailProfile is not provided
- Updated parameter description with agent-appropriate phrasing ("ask your user/owner")
- Removed separate get_profiles tool for cleaner API
- Connect tool now handles both profile listing and connection in one place

## 2025-07-24 21:15

- Modified startPlaywriter to accept optional emailProfile parameter
- Removed prompts dependency and interactive profile selection
- Connect tool now accepts emailProfile parameter or returns available profiles
- Added security guidance for profile selection in MCP response
- Suggests storing selected email in AGENTS.md or CLAUDE.md to avoid repeated selection

## 2025-07-24 21:00

- Integrated Chrome launch via startPlaywriter from playwriter.ts
- Connect tool now starts Chrome with CDP port and connects via playwright.chromium.connectOverCDP
- Added proper cleanup handlers for browser and Chrome process on server shutdown
- Removed placeholder getActivePage function in favor of direct browser connection

## 2025-07-24 20:50

- Moved console object definition outside of the Function constructor template string
- Improved code readability and maintainability

## 2025-07-24 20:45

- Refactored console capture to use a custom console object instead of overriding global console
- Cleaner implementation that avoids modifying global state

## 2025-07-24 20:40

- Enhanced execute tool to capture console.log, console.info, console.warn, console.error, and console.debug output
- Console methods are temporarily overridden during code execution to collect logs
- Output now includes both console logs and return values in a formatted response

## 2025-07-24 20:35

- Added execute tool to run arbitrary JavaScript code with page and context in scope
- The tool uses the Playwright automation guide from prompt.md as its description

## 2025-07-24 20:30

- Fixed MCP server tool registration API usage to match the correct method signature (name, description, schema, handler)