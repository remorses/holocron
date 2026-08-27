---
'@holocron.so/vite': minor
---

Add operation-level `x-holocron` page overrides to generated OpenAPI documentation. The Mintlify-compatible `x-mint` extension works as an alias, while `x-holocron` wins field by field when both are present.

Use `metadata.title`, `metadata.sidebarTitle`, and `metadata.description` to customize page metadata. Add `content` for badges, callouts, and other compatible MDX components between the endpoint description and generated fields. Set `href` to choose an internal endpoint URL.

Legacy specifications that place `title`, `sidebarTitle`, and `description` directly inside `x-mint` or `x-holocron` remain supported.

```yaml
paths:
  /users:
    post:
      x-holocron:
        metadata:
          title: Create a new user
          sidebarTitle: Create user
        content: '<Badge color="blue">1 Credit</Badge>'
        href: /api-reference/users/create
```
