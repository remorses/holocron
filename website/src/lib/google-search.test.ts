import { describe, test, expect } from 'vitest'
import { googleSearch } from './google-search'

describe('googleSearch', () => {
  test('returns search results from Google', async () => {
    const result = await googleSearch({
      query: 'vitest',
      limit: 5,
    })
    
    expect(result).toMatchInlineSnapshot(`
      {
        "context": {
          "title": "Fumabase Search",
        },
        "items": [
          {
            "displayLink": "vitest.dev",
            "formattedUrl": "https://vitest.dev/",
            "htmlFormattedUrl": "https://<b>vitest</b>.dev/",
            "htmlSnippet": "A Vite-native testing framework. It&#39;s fast! Get Started Features Why <b>Vitest</b>? View on GitHub <b>Vitest</b> Vite Powered Reuse Vite&#39;s config and plugins.",
            "htmlTitle": "<b>Vitest</b> | Next Generation testing framework",
            "kind": "customsearch#result",
            "link": "https://vitest.dev/",
            "pagemap": {
              "cse_image": [
                {
                  "src": "https://vitest.dev/og.png",
                },
              ],
              "cse_thumbnail": [
                {
                  "height": "162",
                  "src": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcS_qLvtyYUWFLyq935eBsp-BDVCQodfdz_n7DDjE909E5K5cOWTPqrLx74&s",
                  "width": "310",
                },
              ],
              "metatags": [
                {
                  "author": "Vladimir, Anthony Fu, Ari Perkkiö, Hiroshi Ogawa, Patak, Joaquín Sánchez and Vitest contributors",
                  "og:description": "Next generation testing framework powered by Vite",
                  "og:image": "https://vitest.dev/og.png",
                  "og:title": "Vitest",
                  "og:url": "https://vitest.dev/",
                  "theme-color": "#729b1a",
                  "twitter:card": "summary_large_image",
                  "viewport": "width=device-width,initial-scale=1",
                },
              ],
            },
            "snippet": "A Vite-native testing framework. It's fast! Get Started Features Why Vitest? View on GitHub Vitest Vite Powered Reuse Vite's config and plugins.",
            "title": "Vitest | Next Generation testing framework",
          },
          {
            "displayLink": "github.com",
            "formattedUrl": "https://github.com/vitest-dev/vitest",
            "htmlFormattedUrl": "https://github.com/<b>vitest</b>-dev/<b>vitest</b>",
            "htmlSnippet": "Next generation testing framework powered by Vite. Get involved! Documentation | Getting Started | Examples | Why <b>Vitest</b>?",
            "htmlTitle": "vitest-dev/vitest: Next generation testing framework ... - GitHub",
            "kind": "customsearch#result",
            "link": "https://github.com/vitest-dev/vitest",
            "pagemap": {
              "cse_image": [
                {
                  "src": "https://opengraph.githubassets.com/c379a87856b5ac161759661c27e35bc04c52d8008ec8d1ef79d005d741b11ffa/vitest-dev/vitest",
                },
              ],
              "cse_thumbnail": [
                {
                  "height": "159",
                  "src": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQXIk5ZViR9VPqUCoeGT66bB_UmnL9kDAvlp--Wy8E_ouAIdiuqkGig_nU&s",
                  "width": "318",
                },
              ],
              "metatags": [
                {
                  "analytics-location": "/<user-name>/<repo-name>",
                  "apple-itunes-app": "app-id=1477376905, app-argument=https://github.com/vitest-dev/vitest",
                  "browser-errors-url": "https://api.github.com/_private/browser/errors",
                  "browser-stats-url": "https://api.github.com/_private/browser/stats",
                  "color-scheme": "light dark",
                  "current-catalog-service-hash": "f3abb0cc802f3d7b95fc8762b94bdcb13bf39634c40c357301c4aa1d67a256fb",
                  "expected-hostname": "github.com",
                  "fb:app_id": "1401488693436528",
                  "fetch-nonce": "v2:f7e367be-0908-ca91-24fb-711d74d85ad8",
                  "github-keyboard-shortcuts": "repository,copilot",
                  "go-import": "github.com/vitest-dev/vitest git https://github.com/vitest-dev/vitest.git",
                  "hostname": "github.com",
                  "hovercard-subject-tag": "repository:434708679",
                  "html-safe-nonce": "227881b00cae73dcdb55ba43b41ba677dca28fbc6b48ee795e8e96a67c72eec8",
                  "octolytics-dimension-repository_id": "434708679",
                  "octolytics-dimension-repository_is_fork": "false",
                  "octolytics-dimension-repository_network_root_id": "434708679",
                  "octolytics-dimension-repository_network_root_nwo": "vitest-dev/vitest",
                  "octolytics-dimension-repository_nwo": "vitest-dev/vitest",
                  "octolytics-dimension-repository_public": "true",
                  "octolytics-dimension-user_id": "95747107",
                  "octolytics-dimension-user_login": "vitest-dev",
                  "octolytics-url": "https://collector.github.com/github/collect",
                  "og:description": "Next generation testing framework powered by Vite. - vitest-dev/vitest",
                  "og:image": "https://opengraph.githubassets.com/c379a87856b5ac161759661c27e35bc04c52d8008ec8d1ef79d005d741b11ffa/vitest-dev/vitest",
                  "og:image:alt": "Next generation testing framework powered by Vite. - vitest-dev/vitest",
                  "og:image:height": "600",
                  "og:image:width": "1200",
                  "og:site_name": "GitHub",
                  "og:title": "GitHub - vitest-dev/vitest: Next generation testing framework powered by Vite.",
                  "og:type": "object",
                  "og:url": "https://github.com/vitest-dev/vitest",
                  "release": "82588848b187a5a7487d84256afbed1e318c0371",
                  "request-id": "A62D:169780:9535FA:BD243F:68BD3D8B",
                  "route-action": "disambiguate",
                  "route-controller": "files",
                  "route-pattern": "/:user_id/:repository",
                  "theme-color": "#1e2327",
                  "turbo-body-classes": "logged-out env-production page-responsive",
                  "turbo-cache-control": "no-preview",
                  "twitter:card": "summary_large_image",
                  "twitter:description": "Next generation testing framework powered by Vite. - vitest-dev/vitest",
                  "twitter:image": "https://opengraph.githubassets.com/c379a87856b5ac161759661c27e35bc04c52d8008ec8d1ef79d005d741b11ffa/vitest-dev/vitest",
                  "twitter:site": "@github",
                  "twitter:title": "GitHub - vitest-dev/vitest: Next generation testing framework powered by Vite.",
                  "ui-target": "full",
                  "viewport": "width=device-width",
                  "visitor-hmac": "5d48a822a48df35f3be297b7cc1c0974d32d2553f818f2c89c37b0fe773dba50",
                  "visitor-payload": "eyJyZWZlcnJlciI6IiIsInJlcXVlc3RfaWQiOiJBNjJEOjE2OTc4MDo5NTM1RkE6QkQyNDNGOjY4QkQzRDhCIiwidmlzaXRvcl9pZCI6IjM5MjM4NTI2Njg0OTcxMTY1NTUiLCJyZWdpb25fZWRnZSI6ImlhZCIsInJlZ2lvbl9yZW5kZXIiOiJpYWQifQ==",
                },
              ],
              "softwaresourcecode": [
                {
                  "author": "vitest-dev",
                  "name": "vitest",
                  "text": "Vitest Next generation testing framework powered by Vite. Get involved! Documentation | Getting Started | Examples | Why Vitest? 中文文档 Features Vite's config, transformers, resolvers,...",
                },
              ],
            },
            "snippet": "Next generation testing framework powered by Vite. Get involved! Documentation | Getting Started | Examples | Why Vitest?",
            "title": "vitest-dev/vitest: Next generation testing framework ... - GitHub",
          },
          {
            "displayLink": "vitest.dev",
            "formattedUrl": "https://vitest.dev/guide/",
            "htmlFormattedUrl": "https://<b>vitest</b>.dev/guide/",
            "htmlSnippet": "May 5, 2025 <b>...</b> You can try <b>Vitest</b> online on StackBlitz. It runs <b>Vitest</b> directly in the browser, and it is almost identical to the local setup but doesn&#39;t require installing&nbsp;...",
            "htmlTitle": "Getting Started | Guide | <b>Vitest</b>",
            "kind": "customsearch#result",
            "link": "https://vitest.dev/guide/",
            "pagemap": {
              "cse_image": [
                {
                  "src": "https://vitest.dev/og.png",
                },
              ],
              "cse_thumbnail": [
                {
                  "height": "162",
                  "src": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcS_qLvtyYUWFLyq935eBsp-BDVCQodfdz_n7DDjE909E5K5cOWTPqrLx74&s",
                  "width": "310",
                },
              ],
              "metatags": [
                {
                  "author": "Vladimir, Anthony Fu, Ari Perkkiö, Hiroshi Ogawa, Patak, Joaquín Sánchez and Vitest contributors",
                  "og:description": "Next generation testing framework powered by Vite",
                  "og:image": "https://vitest.dev/og.png",
                  "og:title": "Vitest",
                  "og:url": "https://vitest.dev/",
                  "theme-color": "#729b1a",
                  "twitter:card": "summary_large_image",
                  "viewport": "width=device-width,initial-scale=1",
                },
              ],
            },
            "snippet": "May 5, 2025 ... You can try Vitest online on StackBlitz. It runs Vitest directly in the browser, and it is almost identical to the local setup but doesn't require installing ...",
            "title": "Getting Started | Guide | Vitest",
          },
          {
            "displayLink": "www.reddit.com",
            "formattedUrl": "https://www.reddit.com/r/node/.../is_vitest_still_necessary_in_2025/",
            "htmlFormattedUrl": "https://www.reddit.com/r/node/.../is_<b>vitest</b>_still_necessary_in_2025/",
            "htmlSnippet": "Feb 13, 2025 <b>...</b> <b>Vitest</b> is functionally a superset of Jest&#39;s features, while being lighter weight and lower memory usage due to sharing the internals of Vite. If&nbsp;...",
            "htmlTitle": "Is <b>Vitest</b> still necessary in 2025? : r/node",
            "kind": "customsearch#result",
            "link": "https://www.reddit.com/r/node/comments/1ioguv6/is_vitest_still_necessary_in_2025/",
            "pagemap": {
              "metatags": [
                {
                  "apple-mobile-web-app-capable": "yes",
                  "apple-mobile-web-app-status-bar-style": "black",
                  "msapplication-navbutton-color": "#000000",
                  "og:description": "Posted by u/Agitated_Syllabub346 - 18 votes and 42 comments",
                  "og:image": "https://share.redd.it/preview/post/1ioguv6",
                  "og:image:alt": "An image containing a preview of the post",
                  "og:image:height": "630",
                  "og:image:width": "1200",
                  "og:site_name": "Reddit",
                  "og:title": "r/node on Reddit: Is Vitest still necessary in 2025?",
                  "og:ttl": "600",
                  "og:type": "website",
                  "og:url": "https://www.reddit.com/r/node/comments/1ioguv6/is_vitest_still_necessary_in_2025/?seeker-session=true",
                  "theme-color": "#000000",
                  "twitter:card": "summary_large_image",
                  "twitter:image": "https://share.redd.it/preview/post/1ioguv6",
                  "twitter:site": "@reddit",
                  "twitter:title": "r/node on Reddit: Is Vitest still necessary in 2025?",
                  "viewport": "width=device-width, initial-scale=1, viewport-fit=cover",
                },
              ],
            },
            "snippet": "Feb 13, 2025 ... Vitest is functionally a superset of Jest's features, while being lighter weight and lower memory usage due to sharing the internals of Vite. If ...",
            "title": "Is Vitest still necessary in 2025? : r/node",
          },
          {
            "displayLink": "www.npmjs.com",
            "formattedUrl": "https://www.npmjs.com/package/vitest",
            "htmlFormattedUrl": "https://www.npmjs.com/package/<b>vitest</b>",
            "htmlSnippet": "Jun 17, 2025 <b>...</b> Next generation testing framework powered by Vite. Latest version: 3.2.4, last published: 3 months ago. Start using <b>vitest</b> in your project&nbsp;...",
            "htmlTitle": "<b>vitest</b> - npm",
            "kind": "customsearch#result",
            "link": "https://www.npmjs.com/package/vitest",
            "pagemap": {
              "cse_image": [
                {
                  "src": "https://static-production.npmjs.com/338e4905a2684ca96e08c7780fc68412.png",
                },
              ],
              "cse_thumbnail": [
                {
                  "height": "163",
                  "src": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcR9_PIZpTqIpa0liCRRnQUmkhj2w3NCMbs2QR_X8Qe2cC-areLX1GkLYUF6&s",
                  "width": "310",
                },
              ],
              "metatags": [
                {
                  "apple-mobile-web-app-capable": "yes",
                  "mobile-web-app-capable": "yes",
                  "msapplication-config": "https://static-production.npmjs.com/668aac888e52ae13cac9cfd71fabd31f.xml",
                  "msapplication-tilecolor": "#cb3837",
                  "msapplication-tileimage": "https://static-production.npmjs.com/7a7ffabbd910fc60161bc04f2cee4160.png",
                  "og:description": "Next generation testing framework powered by Vite. Latest version: 3.2.4, last published: 3 months ago. Start using vitest in your project by running \`npm i vitest\`. There are 1243 other projects in the npm registry using vitest.",
                  "og:image": "https://static-production.npmjs.com/338e4905a2684ca96e08c7780fc68412.png",
                  "og:site_name": "npm",
                  "og:title": "vitest",
                  "og:url": "https://www.npmjs.com/package/vitest",
                  "theme-color": "#cb3837",
                  "twitter:card": "summary",
                  "twitter:description": "Next generation testing framework powered by Vite. Latest version: 3.2.4, last published: 3 months ago. Start using vitest in your project by running \`npm i vitest\`. There are 1243 other projects in the npm registry using vitest.",
                  "twitter:title": "npm: vitest",
                  "twitter:url": "https://www.npmjs.com/package/vitest",
                  "viewport": "width=device-width,minimum-scale=1.0,initial-scale=1,user-scalable=yes",
                },
              ],
            },
            "snippet": "Jun 17, 2025 ... Next generation testing framework powered by Vite. Latest version: 3.2.4, last published: 3 months ago. Start using vitest in your project ...",
            "title": "vitest - npm",
          },
        ],
        "kind": "customsearch#search",
        "queries": {
          "nextPage": [
            {
              "count": 5,
              "cx": "c47c2b14ae81745dc",
              "inputEncoding": "utf8",
              "outputEncoding": "utf8",
              "safe": "off",
              "searchTerms": "vitest",
              "startIndex": 6,
              "title": "Google Custom Search - vitest",
              "totalResults": "600000",
            },
          ],
          "request": [
            {
              "count": 5,
              "cx": "c47c2b14ae81745dc",
              "inputEncoding": "utf8",
              "outputEncoding": "utf8",
              "safe": "off",
              "searchTerms": "vitest",
              "startIndex": 1,
              "title": "Google Custom Search - vitest",
              "totalResults": "600000",
            },
          ],
        },
        "searchInformation": {
          "formattedSearchTime": "0.27",
          "formattedTotalResults": "600,000",
          "searchTime": 0.274391,
          "totalResults": "600000",
        },
        "url": {
          "template": "https://www.googleapis.com/customsearch/v1?q={searchTerms}&num={count?}&start={startIndex?}&lr={language?}&safe={safe?}&cx={cx?}&sort={sort?}&filter={filter?}&gl={gl?}&cr={cr?}&googlehost={googleHost?}&c2coff={disableCnTwTranslation?}&hq={hq?}&hl={hl?}&siteSearch={siteSearch?}&siteSearchFilter={siteSearchFilter?}&exactTerms={exactTerms?}&excludeTerms={excludeTerms?}&linkSite={linkSite?}&orTerms={orTerms?}&dateRestrict={dateRestrict?}&lowRange={lowRange?}&highRange={highRange?}&searchType={searchType}&fileType={fileType?}&rights={rights?}&imgSize={imgSize?}&imgType={imgType?}&imgColorType={imgColorType?}&imgDominantColor={imgDominantColor?}&alt=json",
          "type": "application/json",
        },
      }
    `)
  })
})