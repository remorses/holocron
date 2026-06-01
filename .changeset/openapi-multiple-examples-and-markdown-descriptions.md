---
'@holocron.so/vite': minor
---

Improve OpenAPI rendering with multiple examples and Markdown descriptions.

**Multiple examples render as switchable tabs.** When an OpenAPI operation defines several named examples for a request body or response (the `examples` map), Holocron now renders all of them as a tabbed code group in the request/response example column instead of showing only the first. The example names become the tab labels.

```yaml
responses:
  '201':
    content:
      application/json:
        examples:
          Confirmed order:
            value: { id: 'order-001', status: 'pending' }
          Empty order:
            value: { id: 'order-002', items: [] }
```

Both examples appear as tabs labeled "Confirmed order" and "Empty order". A single `example` keeps the previous single-block behavior.

**Markdown in descriptions.** OpenAPI `description` fields are Markdown by spec. Holocron now renders them as formatted HTML (headings, lists, inline code, links, emphasis, code blocks) everywhere they appear: the endpoint summary, parameters, schema properties, request bodies, and responses. Previously they were dumped as plain text. The page `<meta>` description is still flattened to clean plain text.

Closes #96
