---
'@holocron.so/vite': minor
---

Add dev HMR for OpenAPI spec files. Editing a local `.yaml` or `.json` spec now triggers an automatic re-sync so generated API reference pages update without restarting the dev server.

Virtual tab providers can declare `watchPaths` in their result. The OpenAPI provider returns resolved spec file paths, which the Vite plugin watches via chokidar and handles in the `hotUpdate` hook.
