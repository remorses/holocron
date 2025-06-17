import { describe, it, expect } from 'vitest'
import { printDirectoryTree } from './directory-tree'

describe('printDirectoryTree', () => {
    it('prints tree for a simple mock FS', () => {
        const mockFS = {
            files: {
                '/': ['dirA', 'file1.txt'],
                '/dirA': ['file2.md'],
            },
            stats: {
                '/': {
                    isFile: () => false,
                    isDirectory: () => true,
                    isSymbolicLink: () => false,
                    size: 10,
                    ino: 1,
                },
                '/dirA': {
                    isFile: () => false,
                    isDirectory: () => true,
                    isSymbolicLink: () => false,
                    size: 5,
                    ino: 2,
                },
                '/file1.txt': {
                    isFile: () => true,
                    isDirectory: () => false,
                    isSymbolicLink: () => false,
                    size: 1,
                    ino: 3,
                },
                '/dirA/file2.md': {
                    isFile: () => true,
                    isDirectory: () => false,
                    isSymbolicLink: () => false,
                    size: 2,
                    ino: 4,
                },
            },
            readdirSync(path: string): string[] {
                return this.files[path] || []
            },
            statSync(path: string) {
                if (!this.stats[path]) throw new Error(`no stat for ${path}`)
                return this.stats[path]
            },
            lstatSync(path: string) {
                if (!this.stats[path]) throw new Error(`no lstat for ${path}`)
                return this.stats[path]
            },
        }

        const tree = printDirectoryTree({
            FS: mockFS,
        })
        expect(tree).toMatchInlineSnapshot(`
          {
            "children": [
              {
                "children": [
                  {
                    "name": "file2.md",
                    "path": "/dirA/file2.md",
                  },
                ],
                "name": "dirA",
                "path": "/dirA",
              },
              {
                "name": "file1.txt",
                "path": "/file1.txt",
              },
            ],
            "name": "",
            "path": "/",
          }
        `)
    })
})
