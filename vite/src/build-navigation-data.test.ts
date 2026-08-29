// generateHolocronData must emit valid JS even when slugs contain quotes.
import { describe, expect, test } from 'vitest'
import {
    generateHolocronData,
    getHolocronDataContract,
    HOLOCRON_DATA_CONTRACT_VERSION,
    HOLOCRON_DATA_REQUIRED_EXPORTS,
    isHolocronDataGenerationError,
} from './build-navigation-data.ts'
import { normalize } from './lib/normalize-config.ts'

describe('generateHolocronData', () => {
    test('emits the complete generated data contract', async () => {
        const config = normalize({
            name: 'Docs',
            navigation: { pages: ['index'] },
        })
        const result = await generateHolocronData({
            config,
            slugs: ['index'],
            getMdxSource: async () => '# Home',
        })
        const dataUrl = `data:text/javascript;base64,${Buffer.from(result.dataChunkSource).toString('base64')}`
        const generated = await import(dataUrl)
        const contract = getHolocronDataContract(generated.getConfig)

        expect(generated.holocronDataContractVersion).toBe(HOLOCRON_DATA_CONTRACT_VERSION)
        expect(HOLOCRON_DATA_REQUIRED_EXPORTS.every((name) => name in generated)).toBe(true)
        expect(HOLOCRON_DATA_REQUIRED_EXPORTS.every((name) => name in contract)).toBe(true)
    })

    test('rejects a generated module with a missing required export', () => {
        const generated = Object.fromEntries(
            HOLOCRON_DATA_REQUIRED_EXPORTS.map((name) => [name, () => undefined]),
        )
        const entry = Object.assign(() => undefined, {
            holocronDataContractVersion: HOLOCRON_DATA_CONTRACT_VERSION,
            holocronData: generated,
        })
        delete generated.runtimeTabEntries

        expect(() => getHolocronDataContract(entry)).toThrow(
            /missing required export.*runtimeTabEntries.*rebuild.*same @holocron\.so\/vite version\/contract/i,
        )
    })

    test('rejects a generated module with a mismatched contract version', () => {
        expect(() => getHolocronDataContract({
            holocronDataContractVersion: HOLOCRON_DATA_CONTRACT_VERSION + 1,
        })).toThrow(
            /expected contract.*received.*rebuild.*same @holocron\.so\/vite version\/contract/i,
        )
    })

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

    test('reports every invalid MDX page in one typed error', async () => {
        const config = normalize({
            name: 'Docs',
            navigation: { pages: ['index', 'broken-one', 'broken-two'] },
        })
        const result = await generateHolocronData({
            config,
            slugs: ['index', 'broken-one', 'broken-two'],
            getMdxSource: async (slug) => {
                if (slug === 'index') return '# Home'
                return `<Card title={>`
            },
        }).catch((error: unknown) => {
            return error
        })

        expect(isHolocronDataGenerationError(result)).toBe(true)
        if (!isHolocronDataGenerationError(result)) return
        const serialized: unknown = JSON.parse(JSON.stringify(result))
        expect(isHolocronDataGenerationError(serialized)).toBe(true)

        expect({
            code: result.code,
            name: result.name,
            pageErrors: result.pageErrors.map(({ slug, error }) => {
                return {
                    slug,
                    code: error.code,
                    source: error.source,
                    line: error.line,
                    column: error.column,
                    reason: error.reason,
                }
            }),
        }).toMatchInlineSnapshot(`
          {
            "code": "HOLOCRON_DATA_GENERATION_FAILED",
            "name": "HolocronDataGenerationError",
            "pageErrors": [
              {
                "code": "HOLOCRON_MDX_PARSE_ERROR",
                "column": 15,
                "line": 1,
                "reason": "Unexpected end of file in expression, expected a corresponding closing brace for \`{\`",
                "slug": "broken-one",
                "source": "/broken-one",
              },
              {
                "code": "HOLOCRON_MDX_PARSE_ERROR",
                "column": 15,
                "line": 1,
                "reason": "Unexpected end of file in expression, expected a corresponding closing brace for \`{\`",
                "slug": "broken-two",
                "source": "/broken-two",
              },
            ],
          }
        `)
    })

    test('processes each MDX source once', async () => {
        const config = normalize({
            name: 'Docs',
            navigation: { pages: ['index', 'guide'] },
        })
        const calls = new Map<string, number>()

        await generateHolocronData({
            config,
            slugs: ['index', 'guide'],
            getMdxSource: async (slug) => {
                calls.set(slug, (calls.get(slug) || 0) + 1)
                return `---\ntitle: ${slug}\n---\n\n# ${slug}`
            },
        })

        expect(Object.fromEntries(calls)).toMatchInlineSnapshot(`
          {
            "guide": 1,
            "index": 1,
          }
        `)
    })
})
