import { createHighlighter, bundledLanguages } from 'shiki/bundle/full'
import path from 'path'
import YAML from 'js-yaml'
import { getProcessor, ProcessorData } from './mdx-heavy'

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
    })
    processorCache.set(extension, processor)
  }
  try {
    const file = await processor.process(markdown)
    const data = file.data as ProcessorData

    return {
      data: {
        ...data,
        markdown,
      },
    }
  } catch (e: any) {
    // // Preserve line and column information for better error display
    // if (e.line || e.position?.start?.line) {
    //     const error: any = new Error(e.reason || e.message || 'MDX compilation error')
    //     error.line = e.line || e.position?.start?.line
    //     error.column = e.column || e.position?.start?.column
    //     error.reason = e.reason
    //     error.stack = e.stack
    //     throw error
    // }
    e.markdown = markdown
    throw e
  }
}
