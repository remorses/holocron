import { describe, it, expect } from 'vitest'
import { printDirectoryTree } from './directory-tree'
import { loader, VirtualFile } from 'fumadocs-core/source'

describe('printDirectoryTree', () => {
    it('prints tree for a simple mock FS', () => {
        const filePaths: { path: string; title: string }[] = [
            { path: 'file1.mdx', title: 'file1' },
            { path: 'dirA/file2.mdx', title: 'file2' },
            { path: 'dirA/meta.json', title: 'meta' },
            { path: 'file3.mdx', title: 'file3' },
            { path: 'docs/page.mdx', title: 'page' },
            { path: 'docs/meta.json', title: 'meta' },
            { path: 'tutorial/step1.mdx', title: 'step1' },
            { path: 'tutorial/step2.mdx', title: 'step2' },
            { path: 'tutorial/steps/meta.json', title: 'meta' },
            { path: 'tutorial/nested/another.mdx', title: 'another' },
        ]

        const tree = printDirectoryTree({
            filePaths,
        })
        expect(tree).toMatchInlineSnapshot(`
          "├── file1.mdx # file1
          ├── dirA
          │   ├── file2.mdx # file2
          │   └── meta.json # meta
          ├── file3.mdx # file3
          ├── docs
          │   ├── page.mdx # page
          │   └── meta.json # meta
          └── tutorial
              ├── step1.mdx # step1
              ├── step2.mdx # step2
              ├── steps
              │   └── meta.json # meta
              └── nested
                  └── another.mdx # another"
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
            filePaths: [{ path: 'single.txt', title: 'single' }],
        })
        expect(tree).toMatchInlineSnapshot(`"└── single.txt # single"`)
    })

    it('handles single directory with one file', () => {
        const tree = printDirectoryTree({
            filePaths: [{ path: 'folder/file.txt', title: 'file' }],
        })
        expect(tree).toMatchInlineSnapshot(`
          "└── folder
              └── file.txt # file"
        `)
    })

    it('handles multiple files in root', () => {
        const tree = printDirectoryTree({
            filePaths: [
                { path: 'file1.txt', title: 'file1' },
                { path: 'file2.txt', title: 'file2' },
                { path: 'file3.txt', title: 'file3' },
            ],
        })
        expect(tree).toMatchInlineSnapshot(`
          "├── file1.txt # file1
          ├── file2.txt # file2
          └── file3.txt # file3"
        `)
    })

    it('handles deeply nested structure', () => {
        const tree = printDirectoryTree({
            filePaths: [
                { path: 'a/b/c/d/e/deep.txt', title: 'deep' },
                { path: 'a/b/c/other.txt', title: 'other' },
                { path: 'a/b/sibling.txt', title: 'sibling' },
                { path: 'a/another.txt', title: 'another' },
            ],
        })
        expect(tree).toMatchInlineSnapshot(`
          "└── a
              ├── b
              │   ├── c
              │   │   ├── d/e
              │   │   │   └── deep.txt # deep
              │   │   └── other.txt # other
              │   └── sibling.txt # sibling
              └── another.txt # another"
        `)
    })

    it('handles files with special characters in names', () => {
        const tree = printDirectoryTree({
            filePaths: [
                {
                    path: 'special chars/file with spaces.txt',
                    title: 'file with spaces',
                },
                {
                    path: 'special chars/file-with-dashes.txt',
                    title: 'file-with-dashes',
                },
                {
                    path: 'special chars/file_with_underscores.txt',
                    title: 'file_with_underscores',
                },
                {
                    path: 'special chars/file.with.dots.txt',
                    title: 'file.with.dots',
                },
            ],
        })
        expect(tree).toMatchInlineSnapshot(`
          "└── special chars
              ├── file with spaces.txt # file with spaces
              ├── file-with-dashes.txt # file-with-dashes
              ├── file_with_underscores.txt # file_with_underscores
              └── file.with.dots.txt # file.with.dots"
        `)
    })

    it('handles mixed file and directory structure', () => {
        const tree = printDirectoryTree({
            filePaths: [
                { path: 'root-file1.txt', title: 'root-file1' },
                { path: 'folder1/file1.txt', title: 'file1' },
                { path: 'root-file2.txt', title: 'root-file2' },
                { path: 'folder2/subfolder/nested.txt', title: 'nested' },
                { path: 'folder1/file2.txt', title: 'file2' },
                { path: 'root-file3.txt', title: 'root-file3' },
            ],
        })
        expect(tree).toMatchInlineSnapshot(`
          "├── root-file1.txt # root-file1
          ├── folder1
          │   ├── file1.txt # file1
          │   └── file2.txt # file2
          ├── root-file2.txt # root-file2
          ├── folder2/subfolder
          │   └── nested.txt # nested
          └── root-file3.txt # root-file3"
        `)
    })

    it('handles duplicate path segments', () => {
        const tree = printDirectoryTree({
            filePaths: [
                { path: 'docs/docs/readme.md', title: 'readme' },
                { path: 'docs/api/docs.md', title: 'docs' },
                { path: 'test/test/test.js', title: 'test' },
            ],
        })
        expect(tree).toMatchInlineSnapshot(`
          "├── docs
          │   ├── docs
          │   │   └── readme.md # readme
          │   └── api
          │       └── docs.md # docs
          └── test/test
              └── test.js # test"
        `)
    })

    it('collapses single-child directories', () => {
        const tree = printDirectoryTree({
            filePaths: [
                { path: 'src/components/ui/button/index.tsx', title: 'button' },
                { path: 'src/components/ui/button/button.test.tsx', title: 'button test' },
                { path: 'src/components/layout/header.tsx', title: 'header' },
                { path: 'src/utils/helpers.ts', title: 'helpers' },
                { path: 'docs/api/v1/endpoints/users.md', title: 'users' },
                { path: 'docs/api/v1/endpoints/posts.md', title: 'posts' },
                { path: 'config/env/production/database.js', title: 'database' },
                { path: 'config/env/development/database.js', title: 'database' },
            ],
        })
        expect(tree).toMatchInlineSnapshot(`
          "├── src
          │   ├── components
          │   │   ├── ui/button
          │   │   │   ├── index.tsx # button
          │   │   │   └── button.test.tsx # button test
          │   │   └── layout
          │   │       └── header.tsx # header
          │   └── utils
          │       └── helpers.ts # helpers
          ├── docs/api/v1/endpoints
          │   ├── users.md # users
          │   └── posts.md # posts
          └── config/env
              ├── production
              │   └── database.js # database
              └── development
                  └── database.js # database"
        `)
    })

    it('collapses root-level single-child directories', () => {
        const tree = printDirectoryTree({
            filePaths: [
                { path: 'a/b/c/file1.txt', title: 'file1' },
                { path: 'a/b/c/file2.txt', title: 'file2' },
                { path: 'x/y/z/data.json', title: 'data' },
                { path: 'x/y/z/config.json', title: 'config' },
                { path: 'foo/bar/baz/index.js', title: 'index' },
                { path: 'foo/bar/baz/test.js', title: 'test' },
            ],
        })
        expect(tree).toMatchInlineSnapshot(`
          "├── a/b/c
          │   ├── file1.txt # file1
          │   └── file2.txt # file2
          ├── x/y/z
          │   ├── data.json # data
          │   └── config.json # config
          └── foo/bar/baz
              ├── index.js # index
              └── test.js # test"
        `)
    })

    it('collapses single root with nested single-child directories', () => {
        const tree = printDirectoryTree({
            filePaths: [
                { path: 'root/child1/child2/child3/file1.txt', title: 'file1' },
                { path: 'root/child1/child2/child3/file2.txt', title: 'file2' },
                { path: 'root/child1/child2/child3/file3.txt', title: 'file3' },
            ],
        })
        expect(tree).toMatchInlineSnapshot(`
          "└── root/child1/child2/child3
              ├── file1.txt # file1
              ├── file2.txt # file2
              └── file3.txt # file3"
        `)
    })
})
