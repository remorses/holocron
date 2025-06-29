import { createHighlighter, bundledLanguages } from 'shiki/bundle/full'
import path from 'path'
import YAML from 'js-yaml'
import { getProcessor, ProcessorData } from './mdx-heavy'

const highlighter = await createHighlighter({
    themes: ['github-dark', 'github-light'],
    langs: Object.keys(bundledLanguages),
})
const processorCache = new Map<
    string | undefined,
    ReturnType<typeof getProcessor>
>()

export async function processMdxInServer({
    markdown,
    extension,
    githubPath,
}: {
    markdown: string
    extension?: string
    githubPath: string
}) {
    if (extension) {
        extension = extension.startsWith('.') ? extension.slice(1) : extension
    }
    let processor = processorCache.get(extension)
    if (!processor) {
        processor = getProcessor({
            extension,
            highlighter,
            onMissingLanguage: (_h, lang) => {
                // throw new Error(`Language ${lang} for shiki not found`)
            },
        })
        processorCache.set(extension, processor)
    }
    try {
        const file = processor.processSync(markdown)
        const data = file.data as ProcessorData

        return {
            data: {
                ...data,
                markdown,
            },
        }
    } catch (e) {
        throw e

        if ('line' in e) {
            throw new Error(
                `Invalid ${extension || 'mdx'} found in ${githubPath}:${e.line} \`${e.message}\``,
            )
        }
        throw e
    }
}
