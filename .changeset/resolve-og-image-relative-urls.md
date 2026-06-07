---
'@holocron.so/vite': patch
---

Resolve relative `og:image` and `twitter:image` frontmatter URLs to absolute URLs.

Social crawlers (Twitter, Discord, Slack, LinkedIn) require absolute URLs to fetch OG images. Previously, setting `og:image: /og-image.jpg` in frontmatter would emit a bare `/og-image.jpg` in the meta tag, which crawlers can't resolve. Now relative paths are resolved against the request origin automatically.

```mdx
---
title: My Page
"og:image": /images/my-og.png
---
```

This now correctly emits `<meta property="og:image" content="https://yoursite.com/images/my-og.png" />`.
