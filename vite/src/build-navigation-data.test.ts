// generateHolocronData must emit valid JS even when slugs contain quotes.
import { describe, expect, test } from 'vitest'
import { generateHolocronData } from './build-navigation-data.ts'
import { normalize } from './lib/normalize-config.ts'

describe('generateHolocronData', () => {
    test('escapes quotes in import() paths so holocron-data.js is valid JS', async () => {
        const slug =
            'pages-with-weird-chars/page-with-quotes-"-what-a-good-\'-library-slugify-no'
        const config = normalize({
            name: 'Docs',
            navigation: { pages: ['index', slug] },
        })
        const result = await generateHolocronData({
            config,
            slugs: ['index', slug],
            getMdxSource: async (s) => {
                return `---\ntitle: ${JSON.stringify(s)}\n---\n\n# ${s}\n`
            },
        })

        const filename = result.pageChunks.get(slug)?.filename
        expect(filename).toBeTruthy()
        const importArg = JSON.stringify(`./${filename}`)
        expect(result.dataChunkSource).toContain(`import(${importArg})`)

        const loaderLine = result.dataChunkSource
            .split('\n')
            .find((line) => {
                return line.includes('import(') && line.includes('page-with-quotes')
            })
        expect(loaderLine).toMatchInlineSnapshot(`"  "pages-with-weird-chars/page-with-quotes-\\"-what-a-good-'-library-slugify-no": () => import("./holocron-page-pages-with-weird-chars--page-with-quotes-\\"-what-a-good-'-library-slugify-no-af4cd76a.js").then((m) => m.default)"`)
    })

    test('emits getIconAtlas with resolved SVG bodies', async () => {
        const config = normalize({
            name: 'Docs',
            icons: { library: 'lucide' },
            navigation: { pages: ['index'] },
        })
        const result = await generateHolocronData({
            config,
            slugs: ['index'],
            getMdxSource: async () => '---\ntitle: Home\nicon: rocket\n---\n\n# Home\n',
        })

        expect(result.dataChunkSource).toContain('export function getIconAtlas()')
        expect(result.dataChunkSource).toContain('lucide:rocket')
    })
})
