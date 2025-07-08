import { Root } from 'mdast'

import { remark } from 'remark'
import { Processor } from 'unified'
import remarkGfm from 'remark-gfm'
import stringify from 'remark-stringify'
import remarkMdx from 'remark-mdx'
import { memoize } from './utils.js'

export const simplerProcessor = remark()
    .use(remarkGfm)
    .use(remarkMdx)
    .use(stringify) as any as Processor

type ProcessorData = { ast: any }

export const processorWithAst = memoize(
    function processorWithAst(processor = simplerProcessor): Processor {
        return processor().use(() => (tree, file) => {
            if (!file.data) file.data = {}
            const data: ProcessorData = file.data as any
            if (tree) {
                data.ast = tree
            }
        })
    },
    { maxSize: 10 },
)
