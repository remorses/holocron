import { createHighlighter, bundledLanguages } from 'shiki/bundle/full'
import YAML from 'js-yaml'
import { getProcessor, ProcessorData } from './mdx'

const highlighter = await createHighlighter({
    themes: ['github-dark', 'github-light'],
    langs: Object.keys(bundledLanguages),
})

export async function processMdxInServer({
    markdown: mdx,
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
    const file = processor.processSync(mdx)
    const data = file.data as ProcessorData
    const frontmatterYaml = data.ast?.children.find(
        (node) => node.type === 'yaml',
    )?.value
    let frontmatter: Record<string, any> = {}
    if (frontmatterYaml) {
        frontmatter = YAML.load(frontmatterYaml) as any
    }
    let title = data.title
    let description
    if (typeof frontmatter.description === 'string') {
        description = frontmatter.description
    }
    if (typeof frontmatter.title === 'string') {
        title = frontmatter.title
    }
    return {
        data: {
            ...data,

            title,
            description,
            frontmatter,
            frontmatterYaml: frontmatterYaml || '',
        },
    }
}
