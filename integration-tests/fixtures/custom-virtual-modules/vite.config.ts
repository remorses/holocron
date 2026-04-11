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
  index: String.raw\`# Virtual Home\n\nThis came from custom virtual modules.\`,
  "getting-started": String.raw\`# Virtual Getting Started\n\nThis also came from custom virtual modules.\`,
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
