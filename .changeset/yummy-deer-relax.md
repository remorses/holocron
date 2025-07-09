---
'docs-website': patch
---

Add query parameter support for MDX route line numbers and filtering. MDX routes now support `showLineNumbers=true` to add line number prefixes with padding, and `startLine`/`endLine` parameters to filter content to specific line ranges (1-based indexing). The llms-full-txt endpoint now includes startLine parameters in search result URLs when line numbers are available, and appends .md extension to all page URLs for direct markdown access. This enables precise content extraction for documentation tools and agents.
