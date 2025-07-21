import { describe, it, expect } from 'vitest';

describe('GitChamber Production API', () => {
  const baseUrl = 'https://gitchamber.com/repos/remorses/gitchamber/main';

  it('should list files', async () => {
    const response = await fetch(`${baseUrl}/files`);
    const data = await response.json();
    
    expect(response.status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
    expect(data).toMatchInlineSnapshot(`
      [
        ".gitignore",
        "AGENTS.md",
        "LICENSE",
        "README.md",
        "package.json",
        "pnpm-lock.yaml",
        "src/mocks/cloudflare-workers.ts",
        "src/worker.test.ts",
        "src/worker.ts",
        "tsconfig.json",
        "vite.config.js",
        "wrangler.jsonc",
      ]
    `);
  });

  it('should search repository', async () => {
    const response = await fetch(`${baseUrl}/search/DurableObject`);
    const text = await response.text();
    
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('text/markdown; charset=utf-8');
    expect(text).toMatchInlineSnapshot(`
      "## [src/mocks/cloudflare-workers.ts](https://gitchamber.com/repos/remorses/gitchamber/main/file/src/mocks/cloudflare-workers.ts?start=1) (line 1)

      \`\`\`
      // Mock for cloudflare:workers module
      export class DurableObject {
        constructor(state: any, env: any) {}
      }

      export interface DurableObjectState {
        storage: {
          sql: any;
          setAlarm: (time: number) => Promise<void>;
          deleteAlarm: () => Promise<void>;
          getAlarm: () => Promise<number | null>;
        };
      }

      export interface DurableObjectNamespace {
        idFromName: (name: string) => string;
        get: (id: string) => any;
      }
      \`\`\`

      ---

      ## [src/worker.ts](https://gitchamber.com/repos/remorses/gitchamber/main/file/src/worker.ts?start=1) (line 1)

      \`\`\`
      /* -----------------------------------------------------------------------
         Cloudflare Worker + Durable Object (SQLite) in one file
         -------------------------------------------------------------------- */

      import { parseTar } from "@mjackson/tar-parser";
      import { DurableObject } from "cloudflare:workers";

      /* ---------- ENV interface ---------------------------- */

      interface Env {
        REPO_CACHE: DurableObjectNamespace;
        GITHUB_TOKEN?: string;
        CACHE_TTL_MS?: string; // e.g. "21600000" (6 h)
      }

      /* ======================================================================
         Durable Object: per‑repo cache
         ==================================================================== */
      export class RepoCache extends DurableObject {
        private sql: SqlStorage;
        private ttl: number;
        private owner?: string;
        private repo?: string;
        private branch?: string;

        constructor...
      \`\`\`"
    `);
  });

  it('should get file content without line numbers', async () => {
    const response = await fetch(`${baseUrl}/file/package.json`);
    const text = await response.text();
    
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('text/plain; charset=utf-8');
    expect(text).toMatchInlineSnapshot(`
      "{
        "name": "gitchamber",
        "version": "0.0.0",
        "description": "",
        "type": "module",
        "scripts": {
          "deployment": "tsc && pnpm wrangler deploy"
        },
        "keywords": [],
        "author": "remorses",
        "license": "ISC",
        "packageManager": "pnpm@10.13.1",
        "devDependencies": {
          "@cloudflare/workers-types": "^4.20250712.0",
          "vite": "^7.0.5",
          "vitest": "^3.2.4",
          "wrangler": "^4.24.3"
        },
        "dependencies": {
          "@mjackson/tar-parser": "^0.3.0",
          "spiceflow": "^1.14.0",
          "zod": "^4.0.5"
        }
      }
      "
    `);
  });

  it('should get file content with line numbers', async () => {
    const response = await fetch(`${baseUrl}/file/package.json?showLineNumbers=true`);
    const text = await response.text();
    
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('text/plain; charset=utf-8');
    expect(text).toMatchInlineSnapshot(`
      " 1  {
       2    "name": "gitchamber",
       3    "version": "0.0.0",
       4    "description": "",
       5    "type": "module",
       6    "scripts": {
       7      "deployment": "tsc && pnpm wrangler deploy"
       8    },
       9    "keywords": [],
      10    "author": "remorses",
      11    "license": "ISC",
      12    "packageManager": "pnpm@10.13.1",
      13    "devDependencies": {
      14      "@cloudflare/workers-types": "^4.20250712.0",
      15      "vite": "^7.0.5",
      16      "vitest": "^3.2.4",
      17      "wrangler": "^4.24.3"
      18    },
      19    "dependencies": {
      20      "@mjackson/tar-parser": "^0.3.0",
      21      "spiceflow": "^1.14.0",
      22      "zod": "^4.0.5"
      23    }
      24  }
      25  
      end of file"
    `);
  });

  it('should get file content with start and end line numbers', async () => {
    const response = await fetch(`${baseUrl}/file/package.json?start=6&end=12`);
    const text = await response.text();
    
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('text/plain; charset=utf-8');
    expect(text).toMatchInlineSnapshot(`
      " 6    "scripts": {
       7      "deployment": "tsc && pnpm wrangler deploy"
       8    },
       9    "keywords": [],
      10    "author": "remorses",
      11    "license": "ISC",
      12    "packageManager": "pnpm@10.13.1","
    `);
  });

  it('should get file content with only start line number', async () => {
    const response = await fetch(`${baseUrl}/file/README.md?start=20`);
    const text = await response.text();
    
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('text/plain; charset=utf-8');
    // Should show 50 lines starting from line 20
    expect(text).toContain('20  ');
    expect(text).toContain('69  ');
    expect(text.split('\n')).toHaveLength(50);
  });

  it('should handle 404 for non-existent file', async () => {
    const response = await fetch(`${baseUrl}/file/nonexistent.txt`);
    
    expect(response.status).toBe(404);
  });

  it('should handle search with no results', async () => {
    const response = await fetch(`${baseUrl}/search/thisdoesnotexistanywhere12345`);
    const text = await response.text();
    
    expect(response.status).toBe(200);
    expect(text).toBe('No results found.');
  });
});