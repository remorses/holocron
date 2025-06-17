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

    it('handles empty file list', () => {
        const tree = printDirectoryTree({
            filePaths: [],
        })
        expect(tree).toMatchInlineSnapshot(`""`)
    })

    it('handles single file', () => {
        const tree = printDirectoryTree({
            filePaths: ['single.txt'],
        })
        expect(tree).toMatchInlineSnapshot(`"single.txt"`)
    })

    it('handles single directory with one file', () => {
        const tree = printDirectoryTree({
            filePaths: ['folder/file.txt'],
        })
        expect(tree).toMatchInlineSnapshot(`
          "folder
          └── file.txt"
        `)
    })

    it('handles multiple files in root', () => {
        const tree = printDirectoryTree({
            filePaths: ['file1.txt', 'file2.txt', 'file3.txt'],
        })
        expect(tree).toMatchInlineSnapshot(`
          "file1.txt
          file2.txt
          file3.txt"
        `)
    })

    it('handles deeply nested structure', () => {
        const tree = printDirectoryTree({
            filePaths: [
                'a/b/c/d/e/deep.txt',
                'a/b/c/other.txt',
                'a/b/sibling.txt',
                'a/another.txt',
            ],
        })
        expect(tree).toMatchInlineSnapshot(`
          "a
          ├── b
          │   ├── c
          │   │   ├── d
          │   │   │   └── e
          │   │   │       └── deep.txt
          │   │   └── other.txt
          │   └── sibling.txt
          └── another.txt"
        `)
    })

    it('handles files with special characters in names', () => {
        const tree = printDirectoryTree({
            filePaths: [
                'special chars/file with spaces.txt',
                'special chars/file-with-dashes.txt',
                'special chars/file_with_underscores.txt',
                'special chars/file.with.dots.txt',
            ],
        })
        expect(tree).toMatchInlineSnapshot(`
          "special chars
          ├── file with spaces.txt
          ├── file-with-dashes.txt
          ├── file_with_underscores.txt
          └── file.with.dots.txt"
        `)
    })

    it('handles mixed file and directory structure', () => {
        const tree = printDirectoryTree({
            filePaths: [
                'root-file1.txt',
                'folder1/file1.txt',
                'root-file2.txt',
                'folder2/subfolder/nested.txt',
                'folder1/file2.txt',
                'root-file3.txt',
            ],
        })
        expect(tree).toMatchInlineSnapshot(`
          "root-file1.txt
          folder1
          ├── file1.txt
          └── file2.txt
          root-file2.txt
          folder2
          └── subfolder
              └── nested.txt
          root-file3.txt"
        `)
    })

    it('handles duplicate path segments', () => {
        const tree = printDirectoryTree({
            filePaths: [
                'docs/docs/readme.md',
                'docs/api/docs.md',
                'test/test/test.js',
            ],
        })
        expect(tree).toMatchInlineSnapshot(`
          "docs
          ├── docs
          │   └── readme.md
          └── api
              └── docs.md
          test
          └── test
              └── test.js"
        `)
    })

})
