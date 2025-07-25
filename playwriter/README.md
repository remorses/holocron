# PlayWriter MCP

A powerful browser automation MCP (Model Context Protocol) server that provides persistent browser sessions with advanced automation capabilities through Playwright.

## Key Differences from playwright-mcp

### 🔒 Persistent Data Directory
PlayWriter MCP maintains a persistent user data directory between runs. This enables:
- Login sessions with Google and other OAuth providers
- Website authentication that persists across sessions
- Test automation without repeated logins
- Preserved cookies, local storage, and browser state

### 🛡️ Anti-Detection Features
Built-in detection prevention mechanisms allow automation on websites with bot protection:
- Works seamlessly with Google and other major platforms
- User-agent rotation
- Automation flag removal
- Realistic browser fingerprinting

### 🌐 Shared Chrome Instance
- Single Chrome instance shared between all agents
- Each agent operates in its own tab
- Efficient resource usage
- Better performance for multi-agent workflows

### 🚀 Single Powerful Execute Tool
Instead of many granular tools, PlayWriter provides one flexible `execute` tool:
- Direct access to Playwright `page` and `context` objects
- Write complex automation logic with loops and conditions
- Full JavaScript execution capabilities
- Custom wait conditions and complex interactions

Example:
```javascript
// Complex wait logic with custom conditions
while (!(await page.isVisible('.success-message'))) {
    await page.click('.retry-button');
    await page.waitForTimeout(1000);
}
```

### 🔧 Additional Tools
- `new_page` - Create a new browser tab/page
- `accessibility_snapshot` - Get page structure as JSON
- `console_logs` - Retrieve browser console messages
- `network_history` - Monitor network requests

## Roadmap

- ☁️ Cloud service integration for shared persistent state
- 🧪 Quality assertion tests in CI/CD pipelines
- 🤖 Multi-agent collaboration features
- 📊 Advanced debugging and monitoring capabilities

## Installation

See the main project documentation for installation and setup instructions.