---
'@holocron.so/vite': patch
---

Fix `<Tree.Folder>`, `<Tree.File>`, `<Color.Row>` and `<Color.Item>` rendering as "Unsupported jsx component". Dotted MDX tags are resolved as a property read on the namespace component, which is a client reference on the server and carries no static properties. Namespace components are now server wrappers that expose their sub-components.
