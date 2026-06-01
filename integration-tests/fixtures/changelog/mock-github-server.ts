/**
 * Tiny in-process mock of the GitHub releases REST API.
 *
 * Started from the fixture's vite.config.ts so the changelog provider (which
 * fetches releases at config-sync time) hits canned data instead of the live
 * GitHub API. Pointed at via the HOLOCRON_CHANGELOG_API_URL env var. This
 * keeps the integration test hermetic and free of rate limits.
 */

import http from "node:http";

const RELEASES = [
  {
    tag_name: "v2.0.0",
    name: "Version 2.0",
    body: "## Highlights\n\n- Rewrote the engine\n- Faster builds",
    published_at: "2026-01-15T00:00:00Z",
    html_url: "https://github.com/acme/widgets/releases/tag/v2.0.0",
    draft: false,
    prerelease: false,
  },
  {
    tag_name: "v1.5.0-beta.1",
    name: "Version 1.5 Beta",
    body: "Trying out the new pipeline.",
    published_at: "2025-12-20T00:00:00Z",
    html_url: "https://github.com/acme/widgets/releases/tag/v1.5.0-beta.1",
    draft: false,
    prerelease: true,
  },
  {
    tag_name: "v1.0.0",
    name: "Version 1.0",
    body: "Initial public release.",
    published_at: "2025-11-01T00:00:00Z",
    html_url: "https://github.com/acme/widgets/releases/tag/v1.0.0",
    draft: false,
    prerelease: false,
  },
  {
    tag_name: "v0.9.0-draft",
    name: "Should not appear",
    body: "This is a draft and must be filtered out.",
    published_at: "2025-10-01T00:00:00Z",
    html_url: "https://github.com/acme/widgets/releases/tag/v0.9.0",
    draft: true,
    prerelease: false,
  },
];

/** Start the mock server and return its base URL. Idempotent per process.
 *  Resolves only once the server is actually listening so the changelog
 *  provider's fetch (which runs right after config load) can reach it. */
export async function startMockGitHubServer(): Promise<string> {
  if (process.env.HOLOCRON_CHANGELOG_API_URL) {
    return process.env.HOLOCRON_CHANGELOG_API_URL;
  }

  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    // /repos/:owner/:repo/releases
    if (/^\/repos\/[^/]+\/[^/]+\/releases$/.test(url.pathname)) {
      const page = Number(url.searchParams.get("page") ?? "1");
      const body = page === 1 ? RELEASES : [];
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(body));
      return;
    }
    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ message: "Not Found" }));
  });

  await new Promise<void>((resolve) => server.listen(0, resolve));
  server.unref();
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("mock github server failed to bind a port");
  }
  const baseUrl = `http://127.0.0.1:${address.port}`;
  process.env.HOLOCRON_CHANGELOG_API_URL = baseUrl;
  return baseUrl;
}
