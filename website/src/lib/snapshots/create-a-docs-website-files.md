# File Tree

├── essentials
│   ├── code.mdx
│   ├── frontmatter.mdx
│   └── images.mdx
├── README.md
└── writing
    ├── accessibility.mdx
    ├── code-examples.mdx
    └── visual-design.mdx


==================================================
FILE: essentials/code.mdx
==================================================
---
title: 'Code Blocks'
description: 'Display inline code and code blocks'
icon: 'code'
---

## Basic

### Inline Code

To denote a `word` or `phrase` as code, enclose it in backticks (`).

```md
To denote a `word` or `phrase` as code, enclose it in backticks (`).
```

### Code Block

Use fenced code blocks by enclosing code in three backticks and specifying the language:

```javascript HelloWorld.js
console.log('Hello, World!');
```



==================================================
FILE: essentials/frontmatter.mdx
==================================================
---
title: 'Frontmatter'
description: 'Configure page metadata and display properties'
icon: 'file-text'
---

Frontmatter is YAML metadata at the top of your file. It controls page title, description, icon, and display settings.

```yaml
---
title: 'Page Title'
description: 'Brief description'
icon: 'icon-name'
---
```



==================================================
FILE: essentials/images.mdx
==================================================
---
title: 'Images and Embeds'
description: 'Add images, videos, and HTML elements'
icon: 'image'
---

## Images

Use Markdown syntax:

```md
![Alt text](/path/image.jpg)
```

Or JSX in MDX:

```jsx
<img src="/path/image.jpg" alt="Alt text" />
```



==================================================
FILE: README.md
==================================================
# Documentation Site

Welcome to your new documentation site!

## Development

1. Install Fumabase CLI:

```bash
npm install -g fumabase
```

2. Start local server:

```bash
fumabase dev
```

3. Push changes to deploy automatically.



==================================================
FILE: writing/accessibility.mdx
==================================================
---
title: 'Writing Accessible Documentation'
description: 'Follow accessibility principles for inclusive docs'
icon: 'accessibility'
---

# Writing Accessible Documentation

Use clear language, semantic HTML, and alt text to ensure all users can read your docs.



==================================================
FILE: writing/code-examples.mdx
==================================================
---
title: 'Writing Effective Code Examples'
description: 'Create accurate, runnable examples with error handling'
icon: 'code'
---

# Writing Effective Code Examples

Ensure examples are complete, include error handling, and show expected outputs.



==================================================
FILE: writing/visual-design.mdx
==================================================
---
title: 'Visual Design for Documentation'
description: 'Use visual elements to improve comprehension'
icon: 'layout-dashboard'
---

# Visual Design for Documentation

Use callouts, images, and typography to guide readers through complex information.