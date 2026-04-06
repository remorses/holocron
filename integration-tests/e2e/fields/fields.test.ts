import { expect, test } from "@playwright/test";

test.describe("site-wide description meta", () => {
  test("<meta name='description'> falls back to root config.description", async ({
    request,
  }) => {
    // `expanded-child.mdx` has no `description` in frontmatter, so the site
    // description should be used.
    const response = await request.get("/expanded-child", {
      headers: { "sec-fetch-dest": "document" },
    });
    const html = await response.text();
    expect(html).toMatch(
      /<meta[^>]*name="description"[^>]*content="A fixture that wires every previously-ignored config field through to runtime\."/,
    );
  });

  test("per-page description overrides site description", async ({ request }) => {
    const response = await request.get("/", {
      headers: { "sec-fetch-dest": "document" },
    });
    const html = await response.text();
    expect(html).toMatch(
      /<meta[^>]*name="description"[^>]*content="Per-page description takes precedence over site description\."/,
    );
  });

  test("<meta property='og:description'> is emitted at site level", async ({
    request,
  }) => {
    const response = await request.get("/expanded-child", {
      headers: { "sec-fetch-dest": "document" },
    });
    const html = await response.text();
    expect(html).toMatch(/<meta[^>]*property="og:description"/);
  });

  test("per-page og:description overrides the site-level og:description", async ({
    request,
  }) => {
    // `/` (index.mdx) sets a per-page description. The corresponding
    // og:description must reflect the per-page value, not the site one.
    const response = await request.get("/", {
      headers: { "sec-fetch-dest": "document" },
    });
    const html = await response.text();
    // Extract the single og:description <meta> tag (spiceflow dedups by
    // property key — only one survives)
    const match = html.match(
      /<meta[^>]*property="og:description"[^>]*content="([^"]+)"/,
    );
    expect(match).not.toBeNull();
    expect(match![1]).toBe("Per-page description takes precedence over site description.");
  });

  test("<meta property='og:site_name'> is emitted", async ({ request }) => {
    const response = await request.get("/", {
      headers: { "sec-fetch-dest": "document" },
    });
    const html = await response.text();
    expect(html).toMatch(/<meta[^>]*property="og:site_name"[^>]*content="Fields Docs"/);
  });
});

// React.cache() is the mechanism that lets <Head> in SiteHead (layout) and
// <Head> in the page component share the same tag store during one RSC render.
// If that shared store breaks, layout-level tags and page-level tags stop
// appearing together in the final SSR document.
test("React.cache() shares the Head store across layout and page SSR", async ({
  request,
}) => {
  const response = await request.get("/", {
    headers: { "sec-fetch-dest": "document" },
  });
  const html = await response.text();
  expect(html).toMatch(/<meta[^>]*property="og:site_name"/);
  expect(html).toMatch(/<meta[^>]*name="description"/);
  expect(html.match(/<title>/g)).toHaveLength(1);
});

test.describe("dark favicon", () => {
  // NOTE: This test is currently skipped because spiceflow's `<Head>`
  // component dedups `<link rel="icon">` tags by a key that does NOT
  // include the `media` attribute (see
  // spiceflow/dist/react/head-processing.js → getLinkKey). Two icon
  // links with different `media` values collapse into one. Fixing
  // requires a small change in spiceflow — see the MEMORY note
  // "Dark favicon blocked by spiceflow link dedup".
  test.skip("emits paired <link rel='icon'> with prefers-color-scheme media queries", async ({
    request,
  }) => {
    const response = await request.get("/", {
      headers: { "sec-fetch-dest": "document" },
    });
    const html = await response.text();
    expect(html).toContain('href="/favicon-light.svg"');
    expect(html).toContain('href="/favicon-dark.svg"');
  });

  // Until spiceflow ships the fix, the layout still renders the LIGHT
  // variant so users with only one favicon (or `light == dark`) continue
  // to get a working icon.
  test("at least the light favicon link is emitted", async ({ request }) => {
    const response = await request.get("/", {
      headers: { "sec-fetch-dest": "document" },
    });
    const html = await response.text();
    expect(html).toMatch(
      /<link[^>]*rel="icon"[^>]*href="\/favicon-light\.svg"/,
    );
  });
});

test.describe("redirects", () => {
  test("exact-match permanent redirect emits 301 + Location header", async ({
    request,
  }) => {
    const response = await request.get("/old", {
      headers: { "sec-fetch-dest": "document" },
      maxRedirects: 0,
    });
    expect(response.status()).toBe(301);
    expect(response.headers()["location"]).toBe("/new");
  });

  test("named param redirect substitutes :id", async ({ request }) => {
    const response = await request.get("/users/42", {
      headers: { "sec-fetch-dest": "document" },
      maxRedirects: 0,
    });
    // Temporary redirect (no `permanent: true` in config)
    expect(response.status()).toBe(302);
    expect(response.headers()["location"]).toBe("/u/42");
  });

  test("wildcard splat redirect captures remaining path", async ({ request }) => {
    const response = await request.get("/blog/hello", {
      headers: { "sec-fetch-dest": "document" },
      maxRedirects: 0,
    });
    expect(response.status()).toBe(302);
    expect(response.headers()["location"]).toBe("/posts/hello");
  });

  test("non-matching path is NOT redirected", async ({ request }) => {
    const response = await request.get("/", {
      headers: { "sec-fetch-dest": "document" },
    });
    expect(response.status()).toBe(200);
  });

  test("query string is preserved across redirect when destination has none", async ({
    request,
  }) => {
    const response = await request.get("/old?ref=x&utm=y", {
      headers: { "sec-fetch-dest": "document" },
      maxRedirects: 0,
    });
    expect(response.status()).toBe(301);
    expect(response.headers()["location"]).toBe("/new?ref=x&utm=y");
  });

  test("query string is preserved on named-param redirect", async ({ request }) => {
    const response = await request.get("/users/42?from=home", {
      headers: { "sec-fetch-dest": "document" },
      maxRedirects: 0,
    });
    expect(response.status()).toBe(302);
    expect(response.headers()["location"]).toBe("/u/42?from=home");
  });

  test("query string is preserved on wildcard redirect", async ({ request }) => {
    const response = await request.get("/blog/hello?foo=bar", {
      headers: { "sec-fetch-dest": "document" },
      maxRedirects: 0,
    });
    expect(response.status()).toBe(302);
    expect(response.headers()["location"]).toBe("/posts/hello?foo=bar");
  });
});

test.describe("hidden filters", () => {
  test("hidden tab does NOT appear in tab bar", async ({ request }) => {
    const response = await request.get("/", {
      headers: { "sec-fetch-dest": "document" },
    });
    const html = await response.text();
    // The secret tab would render as a tab link if not filtered.
    expect(html).not.toContain(">Secret<");
  });

  test("hidden anchor does NOT appear in tab bar", async ({ request }) => {
    const response = await request.get("/", {
      headers: { "sec-fetch-dest": "document" },
    });
    const html = await response.text();
    expect(html).toContain("Visible Anchor");
    expect(html).not.toContain("Hidden Anchor");
  });

  test("hidden nested group does NOT appear in sidebar", async ({ request }) => {
    const response = await request.get("/", {
      headers: { "sec-fetch-dest": "document" },
    });
    const html = await response.text();
    // "Outer" is always rendered at depth 0; "Expanded Nested" and
    // "Collapsed Nested" are nested groups that should appear. "Hidden
    // Nested" should be filtered out entirely.
    expect(html).toContain("Outer");
    expect(html).toContain("Expanded Nested");
    expect(html).toContain("Collapsed Nested");
    expect(html).not.toContain("Hidden Nested");
  });

  test("group with only-hidden descendants is pruned from sidebar", async ({
    request,
  }) => {
    // "Empty Wrapper" has a single child "Hidden Only" which is hidden.
    // After the hidden filter, "Empty Wrapper" is effectively empty and
    // should NOT render a dead section label in the sidebar.
    const response = await request.get("/", {
      headers: { "sec-fetch-dest": "document" },
    });
    const html = await response.text();
    expect(html).not.toContain("Empty Wrapper");
    expect(html).not.toContain("Hidden Only");
  });

  test("page inside a hidden group is still routable", async ({ request }) => {
    const response = await request.get("/hidden-child", {
      headers: { "sec-fetch-dest": "document" },
    });
    expect(response.status()).toBe(200);
    const html = await response.text();
    expect(html).toContain("Reachable via URL, absent from sidebar");
  });
});

test.describe("group.expanded default state", () => {
  // Helper: extract the `aria-expanded` attribute value of the <button>
  // whose visible text label contains `groupName`. Split on `<button` so
  // each chunk corresponds to exactly one button.
  function ariaExpandedOf(html: string, groupName: string): string | null {
    const chunks = html.split("<button");
    const chunk = chunks.find((c) => {
      // Match the button's rendered text — chevron <span>...</span> then
      // the group name directly after. Use a simple heuristic: the chunk
      // should contain "aria-expanded" AND end (before any nested
      // <button>) with the group name before the closing </button>.
      const buttonEnd = c.indexOf("</button>");
      if (buttonEnd === -1) return false;
      const inside = c.slice(0, buttonEnd);
      return inside.includes(">" + groupName) || inside.endsWith(groupName);
    });
    if (!chunk) return null;
    const match = chunk.match(/aria-expanded="([^"]+)"/);
    return match ? match[1]! : null;
  }

  test("expanded nested group starts with aria-expanded='true' in SSR HTML", async ({ request }) => {
    // "Expanded Nested" is `expanded: true` — its collapsible toggle
    // button must have `aria-expanded="true"` in the server-rendered HTML,
    // before any client hydration. Check from a page that does NOT live
    // inside this nested group, so ancestor-expansion doesn't force-open it.
    const response = await request.get("/new", {
      headers: { "sec-fetch-dest": "document" },
    });
    const html = await response.text();
    expect(ariaExpandedOf(html, "Expanded Nested")).toBe("true");
  });

  test("non-expanded nested group starts with aria-expanded='false' in SSR HTML", async ({
    request,
  }) => {
    // Visit "/" so the current page is neither in "Collapsed Nested" nor
    // in any ancestor of it → ancestor-expansion does not auto-open it.
    const response = await request.get("/", {
      headers: { "sec-fetch-dest": "document" },
    });
    const html = await response.text();
    expect(ariaExpandedOf(html, "Collapsed Nested")).toBe("false");
  });
});

test.describe("navbar icon resolution", () => {
  // Each helper extracts the content between the opening <a> tag with a
  // given href and its matching </a>. Navbar links are one-level deep
  // (<a>{<svg/img/span>...}</a>) so a non-greedy match is sufficient.
  function linkInnerByHref(html: string, href: string): string | null {
    const escaped = href.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(
      `<a[^>]*href="${escaped}"[^>]*>([\\s\\S]*?)</a>`,
    );
    const match = html.match(re);
    return match ? match[1]! : null;
  }

  test("type:github link (no explicit icon) renders the lucide github svg", async ({
    request,
  }) => {
    // This is the "invisible github link" regression. Before the fix, the
    // link rendered as <a aria-label="GitHub"></a> — completely empty.
    // After the fix, normalizeNavbar auto-fills link.icon='github' from
    // link.type='github', and <Icon> resolves it via the lucide atlas.
    const response = await request.get("/", {
      headers: { "sec-fetch-dest": "document" },
    });
    const html = await response.text();
    const inner = linkInnerByHref(html, "https://github.com/example/repo");
    expect(inner).not.toBeNull();
    expect(inner!).toContain("<svg");
    expect(inner!).toContain("viewBox=");
    // lucide github icon body contains an <path> with stroke styling
    expect(inner!).toContain("stroke=");
  });

  test("string lucide icon name ('home') resolves via atlas", async ({ request }) => {
    // 'home' is an alias for 'house' in lucide — the resolver should
    // follow the alias chain and emit the house SVG body.
    const response = await request.get("/", {
      headers: { "sec-fetch-dest": "document" },
    });
    const html = await response.text();
    const inner = linkInnerByHref(html, "https://example.com/docs");
    expect(inner).not.toBeNull();
    expect(inner!).toContain("<svg");
    // Should NOT render an <img> because the string is neither URL nor emoji
    expect(inner!).not.toContain("<img");
  });

  test("URL icon (http://...) renders as <img>", async ({ request }) => {
    const response = await request.get("/", {
      headers: { "sec-fetch-dest": "document" },
    });
    const html = await response.text();
    const inner = linkInnerByHref(html, "https://example.com/cdn");
    expect(inner).not.toBeNull();
    expect(inner!).toContain('<img');
    expect(inner!).toContain('src="https://example.com/logo.svg"');
    // Must not render an <svg> — URL icons are raster/image
    expect(inner!).not.toContain("<svg");
  });

  test("emoji icon renders inside <span>, not an <img> or <svg>", async ({
    request,
  }) => {
    const response = await request.get("/", {
      headers: { "sec-fetch-dest": "document" },
    });
    const html = await response.text();
    const inner = linkInnerByHref(html, "https://example.com/emoji");
    expect(inner).not.toBeNull();
    expect(inner!).toContain("🌊");
    expect(inner!).toContain("<span");
    expect(inner!).not.toContain("<img");
    expect(inner!).not.toContain("<svg");
  });

  test("structured icon object { name, library } resolves via atlas", async ({
    request,
  }) => {
    const response = await request.get("/", {
      headers: { "sec-fetch-dest": "document" },
    });
    const html = await response.text();
    const inner = linkInnerByHref(html, "https://example.com/rocket");
    expect(inner).not.toBeNull();
    expect(inner!).toContain("<svg");
    expect(inner!).toContain("viewBox=");
  });

  test("link without icon falls back to rendering its label", async ({
    request,
  }) => {
    // Accessibility fallback — a link with no icon and no type still
    // needs to be visible/clickable, so <Icon> returns null and the
    // label renders as a small text span.
    const response = await request.get("/", {
      headers: { "sec-fetch-dest": "document" },
    });
    const html = await response.text();
    const inner = linkInnerByHref(html, "https://example.com/plain");
    expect(inner).not.toBeNull();
    expect(inner!).toContain("Plain Link");
    expect(inner!).not.toContain("<svg");
    expect(inner!).not.toContain("<img");
  });

  test("navbar.primary type:github renders lucide github svg + label", async ({
    request,
  }) => {
    const response = await request.get("/", {
      headers: { "sec-fetch-dest": "document" },
    });
    const html = await response.text();
    const inner = linkInnerByHref(
      html,
      "https://github.com/example/repo/releases",
    );
    expect(inner).not.toBeNull();
    expect(inner!).toContain("<svg");
    // Label defaults to TYPE_LABELS[github] = "GitHub"
    expect(inner!).toContain("GitHub");
  });
});

test.describe("logo link respects logo.href", () => {
  test("without logo.href, logo links to '/'", async ({ request }) => {
    // This fixture does not set `logo.href`, so the logo Link should still
    // point at the site root.
    const response = await request.get("/", {
      headers: { "sec-fetch-dest": "document" },
    });
    const html = await response.text();
    // Attribute ordering is render-dependent; just verify the slot-logo
    // anchor exists and its href is exactly "/".
    const match = html.match(/<a[^>]*slot-logo[^>]*>/);
    expect(match).not.toBeNull();
    expect(match![0]).toContain('href="/"');
  });
});
