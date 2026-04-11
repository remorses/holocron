/** Fixture-local Vite config that overrides Holocron virtual modules with hardcoded providers. */

import { defineConfig } from "vite";
import { holocron } from "@holocron.so/vite/src/vite-plugin.ts";
import {
  cleanupFixtureRunPaths,
  createE2EViteConfig,
  resolveFixtureRunPaths,
} from "../../scripts/e2e-vite-config.ts";

cleanupFixtureRunPaths(resolveFixtureRunPaths());




const mdxVirtualModule = ts`
const pages = {
  "v1/overview": String.raw\`# Virtual v1 Overview\n\nThis came from custom virtual modules.\`,
  "v1/getting-started": String.raw\`# Virtual v1 Getting Started\n\nThis also came from custom virtual modules.\`,
  "v1/api": String.raw\`# Virtual v1 API\n\nThis page only exists in the virtual config navigation.\`,
  "v2/overview": String.raw\`# Virtual v2 Overview\n\nThis came from custom virtual modules.\`,
  "v2/getting-started": String.raw\`# Virtual v2 Getting Started\n\nThis also came from custom virtual modules.\`,
  "v2/api": String.raw\`# Virtual v2 API\n\nThis page only exists in the virtual config navigation.\`,
}

export async function getMdxSlugs() {
  return Object.keys(pages)
}

export async function getMdxSource(slug) {
  return pages[slug]
}

export async function getPageIconRefs() {
  return []
}
`;

const configVirtualModule = ts`
import { normalize } from "@holocron.so/vite/src/lib/normalize-config.ts"

const config = normalize({
  name: "Virtual Config Override",
  navigation: {
    anchors: [
      {
        anchor: "Changelog",
        href: "https://example.com/changelog",
      },
    ],
    versions: [
      {
        version: "v1.0",
        tag: "Legacy",
        tabs: [
          {
            tab: "Docs",
            groups: [
              {
                group: "Guides",
                pages: ["v1/overview", "v1/getting-started"],
              },
            ],
          },
          {
            tab: "Reference",
            groups: [
              {
                group: "API",
                pages: ["v1/api"],
              },
            ],
          },
        ],
      },
      {
        version: "v2.0",
        tag: "Latest",
        default: true,
        tabs: [
          {
            tab: "Docs",
            groups: [
              {
                group: "Guides",
                pages: ["v2/overview", "v2/getting-started"],
              },
            ],
          },
          {
            tab: "Reference",
            groups: [
              {
                group: "API",
                pages: ["v2/api"],
              },
            ],
          },
        ],
      },
    ],
  },
})

export const base = "/"

export async function getConfig() {
  return config
}
`;

const navigationVirtualModule = ts`
import { buildNavigationData } from "@holocron.so/vite/src/build-navigation-data.ts"
import { getConfig } from "virtual:holocron-config"
import { getMdxSource } from "virtual:holocron-mdx"

export async function getNavigationData() {
  const config = await getConfig()
  return await buildNavigationData({ config, getMdxSource })
}
`;

export default defineConfig(createE2EViteConfig({
  plugins: [
    holocron({
      virtualModules: {
        config: configVirtualModule,
        mdx: mdxVirtualModule,
        navigation: navigationVirtualModule,
      },
    }),
  ],
}));


function ts(strings: TemplateStringsArray, ...exprs: any[]) {
  let result = '';
  strings.forEach((str, i) => {
    result += str + (exprs[i] ?? '');
  });
  return result;
}
