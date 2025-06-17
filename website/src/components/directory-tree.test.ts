import { describe, it, expect } from 'vitest'
import { printDirectoryTree } from './directory-tree'
import { loader, VirtualFile } from 'fumadocs-core/source'

describe('printDirectoryTree', () => {
    it('prints tree for a simple mock FS', () => {
        const filePaths: string[] = [
            'file1.mdx',
            'dirA/file2.mdx',
            'dirA/meta.json',
            'file3.mdx',
            'docs/page.mdx',
            'docs/meta.json',
            'tutorial/step1.mdx',
            'tutorial/step2.mdx',
            'tutorial/steps/meta.json',
            'tutorial/nested/another.mdx',
        ]

        const tree = printDirectoryTree({
            filePaths,
        })
        expect(tree).toMatchInlineSnapshot(`
          "file1.mdx
          dirA
          ├── file2.mdx
          └── meta.json
          file3.mdx
          docs
          ├── page.mdx
          └── meta.json
          tutorial
          ├── step1.mdx
          ├── step2.mdx
          ├── steps
          │   └── meta.json
          └── nested
              └── another.mdx"
        `)
    })

})
