
import { Root } from 'mdast'

import { remark } from 'remark'
import remarkGfm from 'remark-gfm'

export const simplerProcessor = remark().use(remarkGfm)
