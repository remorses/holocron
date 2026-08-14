---
'@holocron.so/vite': patch
---

Add `tailwindSources` plugin option: extra directories, files, or globs appended as Tailwind `@source` directives next to the pagesDir source. Use this when MDX content is generated outside the project at deploy time (e.g. multi-tenant shells that swap `holocron-data.js` per site), pointing at the code that emits the classNames so those utilities are compiled into the shell CSS.

```ts
holocron({
    pagesDir: './src',
    tailwindSources: ['../converters/src/**/*.ts'],
})
```

Paths resolve relative to the vite root. The static prefix of each path is validated at build time so a wrong path fails loudly instead of silently missing classes.
