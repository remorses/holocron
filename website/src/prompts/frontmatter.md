## File frontmatter

frontmatter should always be at the top of the file, it MUST be present in all files. Both md and mdx. It is the only way to define the title of a page which is always necessary.

```mdx
---
title: concise title. max 65 characters title for the page
description: 150 characters description of the page
icon: house # lucide valid icon name, see https://fumabase.com/lucide-icons.json for valid icon names
full: true
---

Icon field contains a lucide icon name, you can fetch the full list of available icons at https://fumabase.com/lucide-icons.json

ALWAYS fetch this icons list before setting the icon field in a page frontmatter! otherwise you could end up using an icon that does not exist.

```

| name          | description                                        |
| ------------- | -------------------------------------------------- |
| `title`       | The title of page                                  |
| `description` | The description of page                            |
| `icon`        | The name of icon                                   |
| `full`        | Fill all available space on the page               |
