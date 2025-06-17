import { describe, it, expect } from 'vitest'
import { printDirectoryTree } from './directory-tree'
import { loader, VirtualFile } from 'fumadocs-core/source'

describe('printDirectoryTree', () => {
    it('prints tree for a simple mock FS', () => {
        const files: VirtualFile[] = [
            { path: 'file1.mdx', type: 'page', data: 'File 1 content' },
            { path: 'dirA/file2.mdx', type: 'page', data: 'File 2 content' },
            {
                path: 'dirA/meta.json',
                type: 'meta',
                data: { title: 'DirA Metadata' },
            },
            { path: 'file3.mdx', type: 'page', data: 'File 3 content' },
            {
                path: 'docs/page.mdx',
                type: 'page',
                data: 'Docs Page Content',
                slugs: ['docs', 'page'],
            },
            {
                path: 'docs/meta.json',
                type: 'meta',
                data: { description: 'Docs Meta' },
            },
            { path: 'tutorial/step1.mdx', type: 'page', data: 'Step 1' },
            { path: 'tutorial/step2.mdx', type: 'page', data: 'Step 2' },
            {
                path: 'tutorial/steps/meta.json',
                type: 'meta',
                data: { title: 'Steps Meta' },
            },
            {
                path: 'tutorial/nested/another.mdx',
                type: 'page',
                data: 'another one',
            },
        ]
        const source = loader({ baseUrl: '', source: { files } })
        const pageTree = source.pageTree
        expect(pageTree).toMatchInlineSnapshot(`
          {
            "$id": "root",
            "children": [
              {
                "$id": "file1.mdx",
                "$ref": {
                  "file": "file1.mdx",
                },
                "description": undefined,
                "icon": undefined,
                "name": "File1",
                "type": "page",
                "url": "/file1",
              },
              {
                "$id": "file3.mdx",
                "$ref": {
                  "file": "file3.mdx",
                },
                "description": undefined,
                "icon": undefined,
                "name": "File3",
                "type": "page",
                "url": "/file3",
              },
              {
                "$id": "dirA",
                "$ref": {
                  "metaFile": "dirA/meta.json",
                },
                "children": [
                  {
                    "$id": "dirA/file2.mdx",
                    "$ref": {
                      "file": "dirA/file2.mdx",
                    },
                    "description": undefined,
                    "icon": undefined,
                    "name": "File2",
                    "type": "page",
                    "url": "/dirA/file2",
                  },
                ],
                "defaultOpen": undefined,
                "description": undefined,
                "icon": undefined,
                "index": undefined,
                "name": "DirA Metadata",
                "root": undefined,
                "type": "folder",
              },
              {
                "$id": "docs",
                "$ref": {
                  "metaFile": "docs/meta.json",
                },
                "children": [
                  {
                    "$id": "docs/page.mdx",
                    "$ref": {
                      "file": "docs/page.mdx",
                    },
                    "description": undefined,
                    "icon": undefined,
                    "name": "Page",
                    "type": "page",
                    "url": "/docs/page",
                  },
                ],
                "defaultOpen": undefined,
                "description": "Docs Meta",
                "icon": undefined,
                "index": undefined,
                "name": "Docs",
                "root": undefined,
                "type": "folder",
              },
              {
                "$id": "tutorial",
                "$ref": undefined,
                "children": [
                  {
                    "$id": "tutorial/step1.mdx",
                    "$ref": {
                      "file": "tutorial/step1.mdx",
                    },
                    "description": undefined,
                    "icon": undefined,
                    "name": "Step1",
                    "type": "page",
                    "url": "/tutorial/step1",
                  },
                  {
                    "$id": "tutorial/step2.mdx",
                    "$ref": {
                      "file": "tutorial/step2.mdx",
                    },
                    "description": undefined,
                    "icon": undefined,
                    "name": "Step2",
                    "type": "page",
                    "url": "/tutorial/step2",
                  },
                  {
                    "$id": "tutorial/nested",
                    "$ref": undefined,
                    "children": [
                      {
                        "$id": "tutorial/nested/another.mdx",
                        "$ref": {
                          "file": "tutorial/nested/another.mdx",
                        },
                        "description": undefined,
                        "icon": undefined,
                        "name": "Another",
                        "type": "page",
                        "url": "/tutorial/nested/another",
                      },
                    ],
                    "defaultOpen": undefined,
                    "description": undefined,
                    "icon": undefined,
                    "index": undefined,
                    "name": "Nested",
                    "root": undefined,
                    "type": "folder",
                  },
                  {
                    "$id": "tutorial/steps",
                    "$ref": {
                      "metaFile": "tutorial/steps/meta.json",
                    },
                    "children": [],
                    "defaultOpen": undefined,
                    "description": undefined,
                    "icon": undefined,
                    "index": undefined,
                    "name": "Steps Meta",
                    "root": undefined,
                    "type": "folder",
                  },
                ],
                "defaultOpen": undefined,
                "description": undefined,
                "icon": undefined,
                "index": undefined,
                "name": "Tutorial",
                "root": undefined,
                "type": "folder",
              },
            ],
            "name": "",
          }
        `)
        const tree = printDirectoryTree({
            pageTree,
        })
        expect(tree).toMatchInlineSnapshot(`
          "├── File1
          ├── File3
          ├── DirA Metadata
          │   └── File2
          ├── Docs
          │   └── Page
          └── Tutorial
              ├── Step1
              ├── Step2
              ├── Nested
              │   └── Another
              └── Steps Meta"
        `)
    })

    it('debug simple tree', () => {
        const simpleTree = {
            name: 'Root',
            children: [
                {
                    type: 'page' as const,
                    name: 'File1',
                    url: '/file1',
                },
                {
                    type: 'folder' as const,
                    name: 'Folder1',
                    children: [
                        {
                            type: 'page' as const,
                            name: 'File2',
                            url: '/folder1/file2',
                        },
                    ],
                },
            ],
        }

        const tree = printDirectoryTree({ pageTree: simpleTree })
        console.log('Debug tree output:')
        console.log(tree)
        expect(tree).toMatchInlineSnapshot(`
          "Root
          ├── File1
          └── Folder1
              └── File2"
        `)
    })
})
