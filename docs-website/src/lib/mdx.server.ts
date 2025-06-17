import { createHighlighter, bundledLanguages } from 'shiki/bundle/full'
import YAML from 'js-yaml'
import { getProcessor, ProcessorData } from './mdx'

const highlighter = await createHighlighter({
    themes: ['github-dark', 'github-light'],
    langs: Object.keys(bundledLanguages),
})

export async function processMdxInServer({
    markdown,
    extension,
}: {
    markdown: string
    extension?: string
}) {
    const processor = getProcessor({
        extension,
        highlighter,
        onMissingLanguage: (_h, lang) => {
            // throw new Error(`Language ${lang} for shiki not found`)
        },
    })
    const file = processor.processSync(markdown)
    const data = file.data as ProcessorData

    return {
        data: {
            ...data,
            markdown,
        },
    }
}
