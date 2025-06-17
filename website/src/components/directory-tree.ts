'use strict'

import { PageTree } from 'fumadocs-core/server'

type Node = PageTree.Node

export function printDirectoryTree({
    pageTree,
}: {
    pageTree: PageTree.Root
}): string {
    function getName(node: PageTree.Root | Node): string {
        if (typeof node.name === 'string') return node.name
        if (typeof node.name === 'number') return node.name.toString()
        return ''
    }

    function printNode(
        node: Node | PageTree.Root,
        prefix: string = '',
        isLast: boolean = true,
    ): string {
        if ('type' in node && node.type === 'separator') {
            // skip separator for printout
            return ''
        }

        const lines: string[] = []
        const name = getName(node)

        // ForPageTree.Root node with empty name, skip printing thePageTree.Root itself
        if (prefix === '' && !('type' in node) && !name) {
            //PageTree.Root node with no name - just process children directly
        } else if (prefix === '' && !('type' in node)) {
            //PageTree.Root node with name
            lines.push(name)
        } else {
            // For non-root nodes, add connector
            const connector = isLast ? '└── ' : '├── '
            lines.push(prefix + connector + name)
        }

        const hasChildren =
            ('type' in node && node.type === 'folder') ||
            //PageTree.Root may not have `type`, but check children
            (!('type' in node) &&
                'children' in node &&
                Array.isArray(node.children))

        if (hasChildren) {
            const children: Node[] = 'children' in node ? node.children : []
            const filteredChildren = children.filter(
                (child) => child.type !== 'separator',
            )

            filteredChildren.forEach((child, idx) => {
                const childIsLast = idx === filteredChildren.length - 1
                // Calculate next prefix based on current node
                let nextPrefix = ''
                if (prefix === '' && !('type' in node)) {
                    //PageTree.Root node - children get no prefix (top level)
                    nextPrefix = ''
                } else {
                    // Folder node - children get indented prefix
                    nextPrefix = prefix + (isLast ? '    ' : '│   ')
                }
                const childOutput = printNode(child, nextPrefix, childIsLast)
                if (childOutput) {
                    lines.push(childOutput)
                }
            })
        }

        return lines.filter((line) => line !== '').join('\n')
    }

    return printNode(pageTree)
}
