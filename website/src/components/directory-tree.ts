'use strict'

interface TreeNode {
    path: string
    title?: string
    children: TreeNode[]
}

export function printDirectoryTree({
    filePaths,
}: {
    filePaths: { path: string, title: string }[]
}): string {
    function buildTree(pathsWithTitles: { path: string, title: string }[]): TreeNode[] {
        const root: TreeNode[] = []
        const nodeMap = new Map<string, TreeNode>()

        for (const { path, title } of pathsWithTitles) {
            const parts = path.split('/').filter(part => part !== '')
            let currentPath = ''
            let currentLevel = root

            for (let i = 0; i < parts.length; i++) {
                const part = parts[i]
                currentPath = currentPath ? `${currentPath}/${part}` : part

                let node = nodeMap.get(currentPath)
                if (!node) {
                    node = {
                        path: currentPath,
                        children: []
                    }
                    // Only assign title on the final part of the path
                    if (i === parts.length - 1) {
                        node.title = title
                    }
                    nodeMap.set(currentPath, node)
                    currentLevel.push(node)
                } else {
                    // If this is the last part and the node is new or title is missing, set title
                    if (i === parts.length - 1 && !node.title) {
                        node.title = title
                    }
                }

                currentLevel = node.children
            }
        }

        return root
    }

    function getName(node: TreeNode): string {
        const parts = node.path.split('/')
        return parts[parts.length - 1] || node.path
    }

    function printNode(
        node: TreeNode,
        prefix: string,
        isLast: boolean,
        isRoot: boolean = false
    ): string {
        const lines: string[] = []
        const name = getName(node)
        const titleSuffix = node.title ? ` # "${node.title}"` : ''

        if (isRoot) {
            // Root level - no prefix
            lines.push(`${name}${titleSuffix}`)
        } else {
            // Child level - add tree connector
            const connector = isLast ? '└── ' : '├── '
            lines.push(prefix + connector + name + titleSuffix)
        }

        // Process children
        if (node.children.length > 0) {
            node.children.forEach((child, idx) => {
                const childIsLast = idx === node.children.length - 1
                let nextPrefix = ''

                if (isRoot) {
                    // Direct children of root get no prefix for their connectors
                    nextPrefix = ''
                } else {
                    // Nested children get extended prefix
                    nextPrefix = prefix + (isLast ? '    ' : '│   ')
                }

                const childOutput = printNode(child, nextPrefix, childIsLast, false)
                lines.push(childOutput)
            })
        }

        return lines.join('\n')
    }

    const tree = buildTree(filePaths)

    if (tree.length === 0) {
        return ''
    }

    return tree.map((node, idx) => {
        const isLast = idx === tree.length - 1
        return printNode(node, '', isLast, true)
    }).join('\n')
}
