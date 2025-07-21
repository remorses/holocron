# web-tree-sitter (Cloudflare Workers Compatible)

This is a patched version of `web-tree-sitter@0.25.8` that has been modified to work in Cloudflare Workers and other edge computing environments.

## Changes Made

### 1. Node.js Polyfills
- Added `_require` fallback for undefined `require` calls
- Wrapped `createRequire` and filesystem operations in try-catch blocks
- Added safety checks for `fs` operations to prevent runtime errors

### 2. URL Handling Fix
- Fixed `findWasmBinary()` function to handle invalid `import.meta.url` in Cloudflare Workers
- Added graceful fallback when URL construction fails

### 3. WebAssembly Module Handling
- Enhanced `Language.load()` to accept `WebAssembly.Module` directly (not just file paths)
- Added cross-context `WebAssembly.Module` detection using `.toString()` check
- Modified `instantiateArrayBuffer()` to handle pre-loaded WASM modules

### 4. Build-time WASM Support
- Modified the initialization flow to support WASM modules imported at build time
- Added `locateFile` callback support for providing WASM modules directly

## Key Files Modified

- `tree-sitter.js` - Main ES module with all compatibility fixes
- `tree-sitter.cjs` - CommonJS version (minimal changes needed)
- `package.json` - Simplified exports and version bump

## How to Update This Package

This package was created by copying files from `node_modules/web-tree-sitter@0.25.8` and applying manual patches. To update:

1. **Copy new version from node_modules:**
   ```bash
   rm -rf /path/to/workspace/web-tree-sitter/*
   cp -r node_modules/web-tree-sitter/* /path/to/workspace/web-tree-sitter/
   ```

2. **Clean up unnecessary files:**
   ```bash
   cd /path/to/workspace/web-tree-sitter
   rm -rf debug lib src node_modules *.map LICENSE README.md
   ```

3. **Apply the patches manually:**
   - Add `_require` polyfill at the top of `tree-sitter.js`
   - Fix `findWasmBinary()` URL handling
   - Update `Language.load()` for `WebAssembly.Module` support
   - Fix `createRequire` and filesystem operations
   - Add cross-context `WebAssembly.Module` detection
   - Update `instantiateArrayBuffer()` for direct module handling

4. **Update package.json:**
   ```json
   {
     "name": "web-tree-sitter",
     "version": "0.25.8-cloudflare-fix",
     "description": "Tree-sitter bindings for the web (Cloudflare Workers compatible)",
     "type": "module",
     "exports": {
       ".": {
         "import": "./tree-sitter.js",
         "require": "./tree-sitter.cjs", 
         "types": "./web-tree-sitter.d.ts"
       },
       "./tree-sitter.wasm": "./tree-sitter.wasm"
     },
     "types": "web-tree-sitter.d.ts"
   }
   ```

5. **Test the changes:**
   ```bash
   pnpm install
   pnpm deployment
   # Test the /tree-sitter-demo endpoint
   ```

## Usage in Cloudflare Workers

```typescript
import { Parser, Language } from "web-tree-sitter";
import jsWasm from "./tree-sitter-javascript.wasm";
import coreWasm from "./tree-sitter-core.wasm";

// Initialize with core WASM module
await Parser.init({
  locateFile(path: string) {
    if (path.endsWith('tree-sitter.wasm')) {
      return coreWasm as any;
    }
    return path;
  }
});

const parser = new Parser();

// Load language with build-time imported WASM
const jsLanguage = await Language.load(jsWasm as any);
parser.setLanguage(jsLanguage);

// Parse code
const tree = parser.parse(sourceCode);
console.log(tree.rootNode.toString());
```

## Compatibility

- ✅ Cloudflare Workers
- ✅ Node.js 
- ✅ Modern browsers
- ✅ Web Workers
- ✅ Other edge runtimes (Deno, Bun)

## Original Package

This is based on [web-tree-sitter](https://github.com/tree-sitter/tree-sitter/tree/master/lib/binding_web) version 0.25.8.