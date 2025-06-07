import { MarkdownPage } from 'db'
import { PageTree } from 'fumadocs-core/server'
import { ReactElement } from 'react'

// --- Sorting Helpers ---
const sortNodes = (nodes: PageTree.Node[]) => {
    nodes.sort((a, b) => {
        // Use empty string for comparison if name is not a string (e.g., for separators)
        const nameA = typeof a.name === 'string' ? a.name : ''
        const nameB = typeof b.name === 'string' ? b.name : ''
        return nameA.localeCompare(nameB)
    })
}

const sortChildrenRecursive = (nodes: PageTree.Node[]) => {
    sortNodes(nodes) // Sort the current level
    nodes.forEach((node) => {
        if (node.type === 'folder' && node.children) {
            sortChildrenRecursive(node.children) // Recurse into folders
        }
    })
}

// --- Utility Functions ---

/**
 * Creates a map of node paths to nodes from a PageTree.
 * Folder paths map to the folder node. Index page URLs might not be directly mapped
 * if they share the same path as the folder; access them via `folder.index`.
 * Page URLs map to the page node.
 */
function createNodeMap(root: PageTree.Root): Record<string, PageTree.Node> {
    const nodeMap: Record<string, PageTree.Node> = {}

    function traverseMap(nodes: PageTree.Node[], parentPath: string) {
        for (const node of nodes) {
            let currentPath: string | undefined

            if (node.type === 'page') {
                currentPath = node.url
                // Map page only if path doesn't already map to a folder
                if (
                    currentPath &&
                    (!nodeMap[currentPath] ||
                        nodeMap[currentPath].type !== 'folder')
                ) {
                    nodeMap[currentPath] = node
                }
            } else if (node.type === 'folder') {
                // Construct folder path based on parent path and folder name
                // Ensure name is a string for path construction
                const nameSegment =
                    typeof node.name === 'string'
                        ? node.name
                        : 'untitled-folder'
                currentPath =
                    parentPath === '/'
                        ? `/${nameSegment}`
                        : `${parentPath}/${nameSegment}`

                if (currentPath) {
                    // Folder node takes precedence in the map over a page at the same path
                    nodeMap[currentPath] = node
                    // Recursively map children
                    if (node.children) {
                        traverseMap(node.children, currentPath)
                    }
                    // Also map the index page URL if it exists and differs from folder path
                    // This helps find the folder via the index page's specific URL if needed
                    if (
                        node.index &&
                        node.index.url &&
                        node.index.url !== currentPath &&
                        !nodeMap[node.index.url] // Avoid overwriting other nodes
                    ) {
                        // Map the index URL to the *folder* node it belongs to
                        nodeMap[node.index.url] = node
                    }
                }
            }
            // Ignore separators or other node types
        }
    }

    traverseMap(root.children, '/')

    // Ensure root page ('/') is mapped if it exists as a direct child
    const rootPageNode = root.children.find(
        (n) => n.type === 'page' && n.url === '/',
    )
    // Map root page only if '/' isn't already mapped (e.g., to a root folder)
    if (rootPageNode && !nodeMap['/']) {
        nodeMap['/'] = rootPageNode
    }

    return nodeMap
}

/** Finds the parent node (must be a folder or the root) and its path for a given node path. */
function findParentNodeAndPath(
    path: string,
    nodeMap: Record<string, PageTree.Node>,
    root: PageTree.Root,
): { parentNode: PageTree.Folder | PageTree.Root; parentPath: string } | null {
    if (path === '/') return null // Root has no parent

    // Calculate parent path ('/a/b' -> '/a', '/a' -> '/')
    const parentPath = path.substring(0, path.lastIndexOf('/')) || '/'
    if (parentPath === '/') {
        return { parentNode: root, parentPath }
    }

    const parentNode = nodeMap[parentPath]
    // Ensure the found parent is actually a folder
    if (parentNode?.type === 'folder') {
        return { parentNode, parentPath }
    }

    // Parent not found in map or is not a folder type
    return null
}

/** Removes a node from its parent's children array or index property. Uses URL for pages, reference otherwise. */
function removeNodeFromParent(
    nodeToRemove: PageTree.Node,
    parentNode: PageTree.Folder | PageTree.Root,
): boolean {
    // Check if it's the index page of a folder (compare by URL)
    if (
        'type' in parentNode &&
        parentNode.type === 'folder' &&
        nodeToRemove.type === 'page' &&
        parentNode.index?.url === nodeToRemove.url
    ) {
        parentNode.index = undefined
        return true
    }

    // Check if it's in the children array
    const children = parentNode.children
    const index = children.findIndex((child) => {
        // Compare pages by URL, other types by reference
        if (child.type === 'page' && nodeToRemove.type === 'page') {
            return child.url === nodeToRemove.url
        }
        return child === nodeToRemove
    })

    if (index > -1) {
        children.splice(index, 1)
        return true
    }

    return false // Node not found in parent
}

/** Recursively deletes a node and its descendants from the map and tree, pruning empty parent folders. */
function deleteNodeRecursive(
    path: string,
    nodeMap: Record<string, PageTree.Node>,
    root: PageTree.Root,
) {
    const nodeToDelete = nodeMap[path]
    if (!nodeToDelete) return // Node doesn't exist or already deleted

    // 1. Remove node from its parent in the actual tree structure
    const parentInfo = findParentNodeAndPath(path, nodeMap, root)
    let parentNode: PageTree.Folder | PageTree.Root | null = null

    if (parentInfo) {
        parentNode = parentInfo.parentNode
        removeNodeFromParent(nodeToDelete, parentNode)
    } else if (path !== '/') {
        // If parent lookup failed (e.g., map inconsistent or parent deleted), check root directly
        if (root.children.includes(nodeToDelete)) {
            parentNode = root
            removeNodeFromParent(nodeToDelete, parentNode)
        } else {
            console.warn(
                `Node ${path} could not be removed from parent during deletion (parent not found or node not in parent).`,
            )
        }
    } else {
        // Node to delete is the root page ('/')
        parentNode = root
        removeNodeFromParent(nodeToDelete, parentNode)
    }

    // 2. Delete the node itself from the map
    delete nodeMap[path]

    // If node was a folder, also delete its index URL mapping if present
    if (nodeToDelete.type === 'folder' && nodeToDelete.index?.url) {
        // Only delete if the index URL maps back to *this* folder
        if (nodeMap[nodeToDelete.index.url] === nodeToDelete) {
            delete nodeMap[nodeToDelete.index.url]
        }
    }

    // 3. If it was a folder, delete all descendants *from the map*
    // (They are already detached from the tree structure)
    if (nodeToDelete.type === 'folder') {
        const prefix = path === '/' ? '/' : path + '/'
        const descendantPaths = Object.keys(nodeMap).filter(
            (k) => k !== path && k.startsWith(prefix),
        )
        for (const descendantPath of descendantPaths) {
            const descendantNode = nodeMap[descendantPath]
            delete nodeMap[descendantPath]
            // Clean up potential index URL mappings for descendant folders
            if (
                descendantNode?.type === 'folder' &&
                descendantNode.index?.url &&
                nodeMap[descendantNode.index.url] === descendantNode
            ) {
                delete nodeMap[descendantNode.index.url]
            }
        }
    }

    // 4. Prune empty parent folder if applicable
    if (
        parentInfo &&
        parentNode &&
        parentNode !== root &&
        'type' in parentNode &&
        parentNode.type === 'folder'
    ) {
        // Check if the parent folder is now empty (no children and no index page)
        if (!parentNode.index && parentNode.children.length === 0) {
            // Recursively delete the now-empty parent folder
            deleteNodeRecursive(parentInfo.parentPath, nodeMap, root)
        }
    }
}

/** Ensures parent folders exist up to the level of the given segments, creating/converting as necessary. Returns the immediate parent node. */
function ensureAndGetParentFolder(
    segments: string[],
    nodeMap: Record<string, PageTree.Node>,
    root: PageTree.Root,
): PageTree.Folder | PageTree.Root {
    let currentPath = ''
    let parentNode: PageTree.Folder | PageTree.Root = root

    // Iterate segments up to the parent level (segments.length - 1)
    for (let i = 0; i < segments.length - 1; i++) {
        const segment = segments[i]
        const folderPath =
            currentPath === '' ? `/${segment}` : `${currentPath}/${segment}`

        let folderNode = nodeMap[folderPath]

        if (!folderNode) {
            // --- Folder does not exist: Create it ---
            folderNode = { type: 'folder', name: segment, children: [] }
            nodeMap[folderPath] = folderNode
            // Link to current parent's children array
            parentNode.children.push(folderNode)
        } else if (folderNode.type === 'page') {
            // --- Path exists but is a Page: Convert to Folder with Page as Index ---
            console.warn(
                `Path ${folderPath} was a page, converting to folder with index for child /${segments.join('/')}`,
            )
            const existingPageNode = folderNode as PageTree.Item
            folderNode = {
                type: 'folder',
                name: segment, // Use segment for folder name
                index: existingPageNode, // Existing page becomes index
                children: [],
            }
            nodeMap[folderPath] = folderNode // Update map to point to the new folder

            // Find and replace the original page node in the parent's children array
            const childIndex = parentNode.children.findIndex(
                (child) =>
                    child.type === 'page' && child.url === existingPageNode.url,
            )
            if (childIndex > -1) {
                parentNode.children.splice(childIndex, 1, folderNode)
            } else {
                // Should not happen if tree/map is consistent, but add as fallback
                console.error(
                    `Could not find page ${existingPageNode.url} in parent children during folder conversion. Adding folder as fallback.`,
                )
                if (!parentNode.children.includes(folderNode)) {
                    parentNode.children.push(folderNode)
                }
            }
        } else if (folderNode.type !== 'folder') {
            // --- Path exists but is neither Page nor Folder (e.g., Separator) ---
            // This is an unrecoverable conflict for creating a folder structure.
            throw new Error(
                `Cannot create folder structure. Path ${folderPath} is occupied by a ${folderNode.type}.`,
            )
        }
        // --- Path exists and is already a Folder: Do nothing ---

        // Move to the next level for the next iteration
        parentNode = folderNode as PageTree.Folder // We ensured it's a folder by this point
        currentPath = folderPath
    }

    return parentNode // Return the immediate parent node (folder or root)
}

function getIconForPage(page: PageDataForTree): ReactElement | undefined {
    const icon = page.icon

    if (!icon) return undefined
    if (icon.startsWith('https://')) {
        return <img className='navIcon' alt='' src={icon} loading='lazy' />
    }
    return <div className=''>{icon}</div>
}

/** Updates an existing node based on page data, or adds a new page node to the tree and map. */
function updateOrAddPage(
    page: PageDataForTree,
    nodeMap: Record<string, PageTree.Node>,
    root: PageTree.Root,
) {
    // Validate essential page data
    if (!page?.slug) {
        console.warn('Skipping page update/add: slug is missing.', page)
        return
    }
    const slug = page.slug
    const title = page.title // Title is optional for updates

    // Calculate path and name
    const segments = slug.split('/').filter(Boolean)
    const pagePath = '/' + segments.join('/')
    const isRootPage = pagePath === '/'
    // Use title if provided, otherwise derive name from last segment or default to 'Home'
    const pageName =
        title ?? (segments.length > 0 ? segments[segments.length - 1] : 'Home')

    const existingNode = nodeMap[pagePath]

    // --- Case 1: Node exists at this exact path ---
    if (existingNode) {
        if (existingNode.type === 'page') {
            // Update existing page's name if title was provided
            if (title !== undefined) {
                existingNode.name = pageName
            }
        } else if (existingNode.type === 'folder') {
            // Path matches a folder. This page might be intended as its index.
            const potentialIndexPage: PageTree.Item = {
                type: 'page',
                name: pageName,
                url: pagePath,
                icon: getIconForPage(page),
            }

            if (existingNode.index && existingNode.index.url === pagePath) {
                // Folder already has an index with the same URL, update its name if title provided
                if (title !== undefined) {
                    existingNode.index.name = pageName
                }
            } else if (!existingNode.index) {
                // Folder exists but has no index, make this page the index
                existingNode.index = potentialIndexPage
                // Ensure the index page URL maps to the folder if needed (handled by createNodeMap logic)
            } else {
                // Folder exists but already has a *different* index page. Log conflict.
                console.error(
                    `Conflict: Page slug ${slug} (${pagePath}) matches folder path which already has index ${existingNode.index.url}. Cannot automatically assign as index.`,
                )
            }
        }
        // If existingNode is a separator or other type, do nothing.
        return // Update/conflict handled
    }

    // --- Case 2: Node does not exist at this path, add it as a new page ---
    const newPageNode: PageTree.Item = {
        type: 'page',
        name: pageName,
        url: pagePath,
    }

    // Handle root page ('/') addition specifically
    if (isRootPage) {
        if (nodeMap['/']) {
            // This should not happen if existingNode check passed. Log error.
            console.error(
                "Logic error: Root page '/' exists in map but wasn't caught by existingNode check.",
            )
            // Attempt to update if it's a page node
            if (nodeMap['/'].type === 'page' && title !== undefined) {
                ;(nodeMap['/'] as PageTree.Item).name = pageName
            }
        } else {
            // Add the new root page to map and root children
            nodeMap['/'] = newPageNode
            // Avoid adding duplicates if somehow already present in children
            if (
                !root.children.some((n) => n.type === 'page' && n.url === '/')
            ) {
                root.children.push(newPageNode)
            }
        }
        return // Root page handled
    }

    // For non-root pages:
    // 1. Ensure parent folders exist (creates/converts if needed) and get the immediate parent
    const parentNode = ensureAndGetParentFolder(segments, nodeMap, root)

    // 2. Add the new page node. Check for conflicts again at the *exact* path,
    //    as ensureAndGetParentFolder might have created/converted a folder there.
    const nodeAtFinalPath = nodeMap[pagePath]
    if (nodeAtFinalPath) {
        // A node (likely a folder created during parent ensure) exists at the target path.
        if (nodeAtFinalPath.type === 'folder') {
            // Make the new page the index of this folder, if it doesn't have one.
            if (!nodeAtFinalPath.index) {
                nodeAtFinalPath.index = newPageNode
                // Folder is already in map and linked to parent. Index attached. Good.
            } else {
                // Folder already has an index. Conflict.
                console.error(
                    `Conflict on add: Page path ${pagePath} matches a folder that already has an index (${nodeAtFinalPath.index.url}). Cannot add page.`,
                )
            }
        } else {
            // Another node type (e.g., page added concurrently?) exists. Log error.
            console.error(
                `Conflict on add: Tried to add page ${pagePath}, but a node of type ${nodeAtFinalPath.type} already exists at this path.`,
            )
            // Overwrite map as fallback? Risky. Let's not add to tree.
            // nodeMap[pagePath] = newPageNode;
        }
    } else {
        // No conflict at the final path. Add the new page node to map and parent's children.
        nodeMap[pagePath] = newPageNode
        parentNode.children.push(newPageNode)
    }
}

// --- Main Update/Build Function ---
//
export interface PageDataForTree {
    slug: string
    title?: string
    icon?: string
}

interface UpdateTreeParams {
    /** Partial page data containing updates or additions. Title is used for update, slug for identification/addition. */
    pages: PageDataForTree[]
    /** The existing tree structure to update. If undefined, a new tree is created from scratch. */
    existingTree?: PageTree.Root
    /** List of page slugs (e.g., 'folder/page', not full paths) for nodes to be deleted. */
    deletedNodeSlugs?: string[]
}

/**
 * Builds or updates a PageTree structure based on provided pages and deletions.
 * Modifies the `existingTree` in place if provided.
 */
export function updateTree({
    pages,
    existingTree,
    deletedNodeSlugs = [],
}: UpdateTreeParams): PageTree.Root {
    // 1. Initialize Root and Node Map
    // Use existing tree or create a new root object. Modification happens in place.
    const root = existingTree || { name: 'Documentation', children: [] }
    // Create a map for efficient node lookup and manipulation
    const nodeMap = createNodeMap(root)

    // 2. Process Deletions
    // Convert slugs to absolute paths (e.g., 'folder/page' -> '/folder/page')
    const deletedPaths = deletedNodeSlugs.map(
        (slug) => '/' + slug.split('/').filter(Boolean).join('/'),
    )
    // Iterate through paths and delete corresponding nodes recursively
    for (const path of deletedPaths) {
        deleteNodeRecursive(path, nodeMap, root)
    }

    // 3. Process Updates and Additions
    // Iterate through provided page data
    for (const page of pages) {
        // Update existing node or add new page node, ensuring parent folders exist
        updateOrAddPage(page, nodeMap, root)
    }

    // 4. Final Sort
    // Sort children alphabetically at all levels of the tree
    sortChildrenRecursive(root.children)

    // 5. Return the modified or newly created tree root
    return root
}

/**
 * Builds a new PageTree from scratch using a list of pages.
 * This is a convenience wrapper around `updateTree`.
 */
export function buildTree(pages: PageDataForTree[]): PageTree.Root {
    // Call updateTree without an existing tree or deletions
    return updateTree({
        pages: pages,
        existingTree: undefined,
        deletedNodeSlugs: [],
    })
}
