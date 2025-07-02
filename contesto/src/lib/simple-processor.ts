import { Root } from 'mdast'

import { remark } from 'remark'
import { Processor } from 'unified'
import remarkGfm from 'remark-gfm'
import { memoize } from './utils.js'

export const simplerProcessor = remark().use(remarkGfm)

type ProcessorData = { ast: any }

export const processorWithAst = memoize(
    function processorWithAst(processor): Processor {
        return processor().use(() => (tree, file) => {
            if (!file.data) file.data = {}
            const data: ProcessorData = file.data
            if (tree) {
                data.ast = tree
            }
        })
    },
    { maxSize: 10 },
)
