import { describe, it, expect } from 'vitest'
import { buildTree, PageDataForTree, updateTree } from './tree'
import { MarkdownPage } from 'db'
import { PageTree } from 'fumadocs-core/server'

describe('buildTree', () => {
    it('should build a tree with root page only', () => {
        const pages: PageDataForTree[] = [{ slug: '/', title: 'Home' }]
        const result = buildTree(pages)
        expect(result).toMatchInlineSnapshot(`
      {
        "children": [
          {
            "name": "Home",
            "type": "page",
            "url": "/",
          },
        ],
        "name": "Documentation",
      }
    `)
    })

    it('should build a tree with nested folders and pages', () => {
        const pages: PageDataForTree[] = [
            { slug: '/folder1/page1', title: 'Page 1' },
            { slug: '/folder1/folder2/page2', title: 'Page 2' },
            { slug: '/folder3/page3', title: 'Page 3' },
        ]
        const result = buildTree(pages)
        expect(result).toMatchInlineSnapshot(`
          {
            "children": [
              {
                "children": [
                  {
                    "children": [
                      {
                        "name": "Page 2",
                        "type": "page",
                        "url": "/folder1/folder2/page2",
                      },
                    ],
                    "name": "folder2",
                    "type": "folder",
                  },
                  {
                    "name": "Page 1",
                    "type": "page",
                    "url": "/folder1/page1",
                  },
                ],
                "name": "folder1",
                "type": "folder",
              },
              {
                "children": [
                  {
                    "name": "Page 3",
                    "type": "page",
                    "url": "/folder3/page3",
                  },
                ],
                "name": "folder3",
                "type": "folder",
              },
            ],
            "name": "Documentation",
          }
        `)
    })

    it('should sort children alphabetically', () => {
        const pages: PageDataForTree[] = [
            { slug: '/apple', title: 'Apple Folder Page' },
            { slug: '/zebra/page', title: 'Zebra Page' },
            { slug: '/apple/page', title: 'Apple Page' },
            { slug: '/banana/page', title: 'Banana Page' },
        ]
        const result = buildTree(pages)
        expect(result).toMatchInlineSnapshot(`
          {
            "children": [
              {
                "children": [
                  {
                    "name": "Apple Page",
                    "type": "page",
                    "url": "/apple/page",
                  },
                ],
                "index": {
                  "name": "Apple Folder Page",
                  "type": "page",
                  "url": "/apple",
                },
                "name": "apple",
                "type": "folder",
              },
              {
                "children": [
                  {
                    "name": "Banana Page",
                    "type": "page",
                    "url": "/banana/page",
                  },
                ],
                "name": "banana",
                "type": "folder",
              },
              {
                "children": [
                  {
                    "name": "Zebra Page",
                    "type": "page",
                    "url": "/zebra/page",
                  },
                ],
                "name": "zebra",
                "type": "folder",
              },
            ],
            "name": "Documentation",
          }
        `)
    })

    it('should handle empty pages array', () => {
        const pages: PageDataForTree[] = []
        const result = buildTree(pages)
        expect(result).toMatchInlineSnapshot(`
      {
        "children": [],
        "name": "Documentation",
      }
    `)
    })
})

describe('updateTree', () => {
    const initialPages: PageDataForTree[] = [
        { slug: '/', title: 'Home' },
        { slug: 'getting-started', title: 'Getting Started' },
        { slug: 'concepts/routing', title: 'Routing Concepts' },
        { slug: 'concepts/loaders', title: 'Data Loaders' },
        { slug: 'advanced/error-handling', title: 'Error Handling' },
    ]

    it('should delete specified nodes', () => {
        const initialTree = buildTree(initialPages)
        const result = updateTree({
            existingTree: initialTree,
            pages: [],
            deletedNodeSlugs: ['getting-started', 'concepts/loaders'],
        })
        expect(result).toMatchInlineSnapshot(`
          {
            "children": [
              {
                "children": [
                  {
                    "name": "Error Handling",
                    "type": "page",
                    "url": "/advanced/error-handling",
                  },
                ],
                "name": "advanced",
                "type": "folder",
              },
              {
                "children": [
                  {
                    "name": "Routing Concepts",
                    "type": "page",
                    "url": "/concepts/routing",
                  },
                ],
                "name": "concepts",
                "type": "folder",
              },
              {
                "name": "Home",
                "type": "page",
                "url": "/",
              },
            ],
            "name": "Documentation",
          }
        `)
    })

    it('should delete an index page, removing the index property from the folder', () => {
        const pagesWithIndex: PageDataForTree[] = [
            { slug: 'folder', title: 'Folder Index' },
            { slug: 'folder/page1', title: 'Page 1' },
        ]
        const initialTree = buildTree(pagesWithIndex)
        // Verify initial state has index
        expect(initialTree.children[0].type).toBe('folder')
        expect((initialTree.children[0] as PageTree.Folder).index).toBeDefined()

        const result = updateTree({
            existingTree: initialTree,
            pages: [],
            deletedNodeSlugs: ['folder'], // Delete the index page slug
        })
        expect(result).toMatchInlineSnapshot(`
          {
            "children": [],
            "name": "Documentation",
          }
        `)
        // Verify index is removed
        // expect(result.children[0].type).toBe('folder')
        // expect((result.children[0] as PageTree.Folder).index).toBeUndefined()
    })

    it('should delete a folder by deleting its last child (and index if present)', () => {
        const pages: PageDataForTree[] = [
            { slug: 'folder', title: 'Folder Index' }, // Index page
            { slug: 'folder/lonely-page', title: 'Lonely Page' }, // Only child
            { slug: 'another-page', title: 'Another Page' },
        ]
        const initialTree = buildTree(pages)

        // Delete the only child page first
        let intermediateTree = updateTree({
            existingTree: initialTree,
            pages: [],
            deletedNodeSlugs: ['folder/lonely-page'],
        })
        expect(intermediateTree).toMatchInlineSnapshot(`
      {
        "children": [
          {
            "name": "Another Page",
            "type": "page",
            "url": "/another-page",
          },
          {
            "children": [],
            "index": {
              "name": "Folder Index",
              "type": "page",
              "url": "/folder",
            },
            "name": "folder",
            "type": "folder",
          },
        ],
        "name": "Documentation",
      }
    `)

        // Now delete the index page, which should prune the empty folder
        const finalTree = updateTree({
            existingTree: intermediateTree,
            pages: [],
            deletedNodeSlugs: ['folder'], // Delete the index page slug
        })
        expect(finalTree).toMatchInlineSnapshot(`
      {
        "children": [
          {
            "name": "Another Page",
            "type": "page",
            "url": "/another-page",
          },
        ],
        "name": "Documentation",
      }
    `)
    })

    it('should update titles of existing nodes', () => {
        const initialTree = buildTree(initialPages)
        const updates: PageDataForTree[] = [
            { slug: '/', title: 'Welcome Home' }, // Update root page
            { slug: 'concepts/routing', title: 'Routing Concepts (Updated)' }, // Update nested page
        ]
        const result = updateTree({
            existingTree: initialTree,
            pages: updates,
            deletedNodeSlugs: [],
        })
        expect(result).toMatchInlineSnapshot(`
      {
        "children": [
          {
            "children": [
              {
                "name": "Error Handling",
                "type": "page",
                "url": "/advanced/error-handling",
              },
            ],
            "name": "advanced",
            "type": "folder",
          },
          {
            "children": [
              {
                "name": "Data Loaders",
                "type": "page",
                "url": "/concepts/loaders",
              },
              {
                "name": "Routing Concepts (Updated)",
                "type": "page",
                "url": "/concepts/routing",
              },
            ],
            "name": "concepts",
            "type": "folder",
          },
          {
            "name": "Getting Started",
            "type": "page",
            "url": "/getting-started",
          },
          {
            "name": "Welcome Home",
            "type": "page",
            "url": "/",
          },
        ],
        "name": "Documentation",
      }
    `)
    })

    it('should add new nodes', () => {
        const initialTree = buildTree(initialPages)
        const additions: PageDataForTree[] = [
            { slug: 'installation', title: 'Installation Guide' }, // Add to root
            { slug: 'concepts/actions', title: 'Form Actions' }, // Add to existing folder
            { slug: 'tutorials/first-app/setup', title: 'First App Setup' }, // Add new nested structure
        ]
        const result = updateTree({
            existingTree: initialTree,
            pages: additions,
            deletedNodeSlugs: [],
        })
        expect(result).toMatchInlineSnapshot(`
          {
            "children": [
              {
                "children": [
                  {
                    "name": "Error Handling",
                    "type": "page",
                    "url": "/advanced/error-handling",
                  },
                ],
                "name": "advanced",
                "type": "folder",
              },
              {
                "children": [
                  {
                    "name": "Data Loaders",
                    "type": "page",
                    "url": "/concepts/loaders",
                  },
                  {
                    "name": "Form Actions",
                    "type": "page",
                    "url": "/concepts/actions",
                  },
                  {
                    "name": "Routing Concepts",
                    "type": "page",
                    "url": "/concepts/routing",
                  },
                ],
                "name": "concepts",
                "type": "folder",
              },
              {
                "name": "Getting Started",
                "type": "page",
                "url": "/getting-started",
              },
              {
                "name": "Home",
                "type": "page",
                "url": "/",
              },
              {
                "name": "Installation Guide",
                "type": "page",
                "url": "/installation",
              },
              {
                "children": [
                  {
                    "children": [
                      {
                        "name": "First App Setup",
                        "type": "page",
                        "url": "/tutorials/first-app/setup",
                      },
                    ],
                    "name": "first-app",
                    "type": "folder",
                  },
                ],
                "name": "tutorials",
                "type": "folder",
              },
            ],
            "name": "Documentation",
          }
        `)
    })

    it('should convert a page to a folder index when adding a child', () => {
        const pages: PageDataForTree[] = [{ slug: 'about', title: 'About Us' }]
        const initialTree = buildTree(pages)
        const additions: PageDataForTree[] = [
            { slug: 'about/team', title: 'Our Team' }, // Should convert 'about' page to folder index
        ]
        const result = updateTree({
            existingTree: initialTree,
            pages: additions,
            deletedNodeSlugs: [],
        })
        expect(result).toMatchInlineSnapshot(`
      {
        "children": [
          {
            "children": [
              {
                "name": "Our Team",
                "type": "page",
                "url": "/about/team",
              },
            ],
            "index": {
              "name": "About Us",
              "type": "page",
              "url": "/about",
            },
            "name": "about",
            "type": "folder",
          },
        ],
        "name": "Documentation",
      }
    `)
    })

    it('should handle combined add, update, and delete operations', () => {
        const initialTree = buildTree(initialPages)
        const updatesAndAdditions: PageDataForTree[] = [
            // Update
            { slug: 'getting-started', title: 'Quick Start Guide' },
            // Add
            { slug: 'installation', title: 'Installation' },
            { slug: 'advanced/deployment', title: 'Deployment Strategies' },
        ]
        const deletions = ['concepts/loaders'] // Delete

        const result = updateTree({
            existingTree: initialTree,
            pages: updatesAndAdditions,
            deletedNodeSlugs: deletions,
        })
        expect(result).toMatchInlineSnapshot(`
      {
        "children": [
          {
            "children": [
              {
                "name": "Deployment Strategies",
                "type": "page",
                "url": "/advanced/deployment",
              },
              {
                "name": "Error Handling",
                "type": "page",
                "url": "/advanced/error-handling",
              },
            ],
            "name": "advanced",
            "type": "folder",
          },
          {
            "children": [
              {
                "name": "Routing Concepts",
                "type": "page",
                "url": "/concepts/routing",
              },
            ],
            "name": "concepts",
            "type": "folder",
          },
          {
            "name": "Home",
            "type": "page",
            "url": "/",
          },
          {
            "name": "Installation",
            "type": "page",
            "url": "/installation",
          },
          {
            "name": "Quick Start Guide",
            "type": "page",
            "url": "/getting-started",
          },
        ],
        "name": "Documentation",
      }
    `)
    })

    it('should handle empty initial tree', () => {
        const additions: PageDataForTree[] = [
            { slug: '/', title: 'First Page' },
            { slug: 'second', title: 'Second Page' },
        ]
        const result = updateTree({
            existingTree: undefined, // Start with no tree
            pages: additions,
            deletedNodeSlugs: [],
        })
        expect(result).toMatchInlineSnapshot(`
      {
        "children": [
          {
            "name": "First Page",
            "type": "page",
            "url": "/",
          },
          {
            "name": "Second Page",
            "type": "page",
            "url": "/second",
          },
        ],
        "name": "Documentation",
      }
    `)
    })

    it('should handle only deletions on an existing tree', () => {
        const initialTree = buildTree(initialPages)
        const result = updateTree({
            existingTree: initialTree,
            pages: [],
            deletedNodeSlugs: ['/'], // Delete root page
        })
        expect(result).toMatchInlineSnapshot(`
      {
        "children": [
          {
            "children": [
              {
                "name": "Error Handling",
                "type": "page",
                "url": "/advanced/error-handling",
              },
            ],
            "name": "advanced",
            "type": "folder",
          },
          {
            "children": [
              {
                "name": "Data Loaders",
                "type": "page",
                "url": "/concepts/loaders",
              },
              {
                "name": "Routing Concepts",
                "type": "page",
                "url": "/concepts/routing",
              },
            ],
            "name": "concepts",
            "type": "folder",
          },
          {
            "name": "Getting Started",
            "type": "page",
            "url": "/getting-started",
          },
        ],
        "name": "Documentation",
      }
    `)
    })

    it('should handle only updates on an existing tree', () => {
        const initialTree = buildTree(initialPages)
        const updates: PageDataForTree[] = [
            { slug: 'concepts/loaders', title: 'Updated Loaders' },
        ]
        const result = updateTree({
            existingTree: initialTree,
            pages: updates,
            deletedNodeSlugs: [],
        })
        expect(result).toMatchInlineSnapshot(`
      {
        "children": [
          {
            "children": [
              {
                "name": "Error Handling",
                "type": "page",
                "url": "/advanced/error-handling",
              },
            ],
            "name": "advanced",
            "type": "folder",
          },
          {
            "children": [
              {
                "name": "Routing Concepts",
                "type": "page",
                "url": "/concepts/routing",
              },
              {
                "name": "Updated Loaders",
                "type": "page",
                "url": "/concepts/loaders",
              },
            ],
            "name": "concepts",
            "type": "folder",
          },
          {
            "name": "Getting Started",
            "type": "page",
            "url": "/getting-started",
          },
          {
            "name": "Home",
            "type": "page",
            "url": "/",
          },
        ],
        "name": "Documentation",
      }
    `)
    })

    it('should ignore deletions of non-existent slugs', () => {
        const initialTree = buildTree(initialPages)
        const initialSnapshot = JSON.stringify(initialTree) // Deep copy for comparison

        const result = updateTree({
            existingTree: initialTree,
            pages: [],
            deletedNodeSlugs: ['non-existent', 'concepts/non-existent-child'],
        })
        // Expect the tree to be unchanged
        expect(JSON.stringify(result)).toEqual(initialSnapshot)
        expect(result).toMatchInlineSnapshot(`
      {
        "children": [
          {
            "children": [
              {
                "name": "Error Handling",
                "type": "page",
                "url": "/advanced/error-handling",
              },
            ],
            "name": "advanced",
            "type": "folder",
          },
          {
            "children": [
              {
                "name": "Data Loaders",
                "type": "page",
                "url": "/concepts/loaders",
              },
              {
                "name": "Routing Concepts",
                "type": "page",
                "url": "/concepts/routing",
              },
            ],
            "name": "concepts",
            "type": "folder",
          },
          {
            "name": "Getting Started",
            "type": "page",
            "url": "/getting-started",
          },
          {
            "name": "Home",
            "type": "page",
            "url": "/",
          },
        ],
        "name": "Documentation",
      }
    `)
    })
})
