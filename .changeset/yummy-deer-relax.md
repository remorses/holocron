---
'docs-website': patch
---

Add query parameter support for MDX route line numbers and filtering. MDX routes now support `showLineNumbers=true` to add line number prefixes with padding, and `startLine`/`endLine` parameters to filter content to specific line ranges (1-based indexing). This enables precise content extraction for documentation tools and agents.
