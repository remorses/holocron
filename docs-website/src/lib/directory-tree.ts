'use strict'

interface TreeNode {
  path: string
  title?: string
  children: TreeNode[]
}

export function printDirectoryTree({ filePaths }: { filePaths: { path: string; title: string }[] }): string {
  function buildTree(pathsWithTitles: { path: string; title: string }[]): TreeNode[] {
    const root: TreeNode[] = []
    const nodeMap = new Map<string, TreeNode>()

    for (const { path, title } of pathsWithTitles) {
      const parts = path.split('/').filter((part) => part !== '')
      let currentPath = ''
      let currentLevel = root

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i]
        currentPath = currentPath ? `${currentPath}/${part}` : part

        let node = nodeMap.get(currentPath)
        if (!node) {
          node = {
            path: currentPath,
            children: [],
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

  function collapseNode(node: TreeNode): {
    path: string
    collapsed: boolean
    children: TreeNode[]
  } {
    // Collapse directories that only contain a single subdirectory (no files)
    let currentNode = node
    let collapsedPath = getName(currentNode)

    while (
      currentNode.children.length === 1 &&
      !currentNode.children[0].title &&
      currentNode.children[0].children.length > 0
    ) {
      currentNode = currentNode.children[0]
      collapsedPath = collapsedPath + '/' + getName(currentNode)
    }

    return {
      path: collapsedPath,
      collapsed: collapsedPath !== getName(node),
      children: currentNode.children,
    }
  }

  function printNode(node: TreeNode, prefix: string, isLast: boolean, isRoot: boolean = false): string {
    const lines: string[] = []
    const titleSuffix = node.title ? ` # ${node.title}` : ''

    // Check if we should collapse this node
    const collapsed = collapseNode(node)
    const displayName = collapsed.path

    // Always add tree connector, even for root level
    const connector = isLast ? '└── ' : '├── '
    lines.push(prefix + connector + displayName + titleSuffix)

    // Process children
    if (collapsed.children.length > 0) {
      collapsed.children.forEach((child, idx) => {
        const childIsLast = idx === collapsed.children.length - 1
        let nextPrefix = ''

        if (isRoot) {
          // Direct children of root get prefix based on parent's position
          nextPrefix = isLast ? '    ' : '│   '
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

  return tree
    .map((node, idx) => {
      const isLast = idx === tree.length - 1
      return printNode(node, '', isLast, true)
    })
    .join('\n')
}
