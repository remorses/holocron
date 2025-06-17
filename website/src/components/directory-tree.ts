'use strict'

import nodePath from 'path'

interface FileSystemAPI {
    readdirSync(path: string): string[]
    statSync(path: string): Stats
    lstatSync(path: string): Stats
}

interface Stats {
    isFile(): boolean
    isDirectory(): boolean
    isSymbolicLink(): boolean
    size: number
    ino: number
    [key: string]: any
}

const constants = {
    DIRECTORY: 'directory',
    FILE: 'file',
} as const

interface DirectoryTreeOptions {
    depth?: number
    attributes?: string[]
    exclude?: RegExp | RegExp[]
    extensions?: RegExp
    normalizePath?: boolean
}

interface DirectoryTreeItem {
    path: string
    name: string
    type?: typeof constants.DIRECTORY | typeof constants.FILE
    extension?: string
    size?: number
    isSymbolicLink?: boolean
    children?: DirectoryTreeItem[]
    [key: string]: any
}

type OnEachFileCallback = (
    item: DirectoryTreeItem,
    path: string,
    stats: Stats,
) => void
type OnEachDirectoryCallback = (
    item: DirectoryTreeItem,
    path: string,
    stats: Stats,
) => void

export function printDirectoryTree({
    FS,
}: {
    FS: FileSystemAPI
}): DirectoryTreeItem | null {
    function safeReadDirSync(path: string): string[] | null {
        let dirData: string[] = []
        try {
            dirData = FS.readdirSync(path)
        } catch (ex: any) {
            if (ex.code == 'EACCES' || ex.code == 'EPERM') {
                return null
            } else throw ex
        }
        return dirData
    }

    function normalizePath(path: string): string {
        return path.replace(/\\/g, '/')
    }

    function isRegExp(regExp: any): regExp is RegExp {
        return typeof regExp === 'object' && regExp.constructor == RegExp
    }

    function directoryTree(
        path: string,
        options?: DirectoryTreeOptions,
        onEachFile?: OnEachFileCallback,
        onEachDirectory?: OnEachDirectoryCallback,
        currentDepth: number = 0,
    ): DirectoryTreeItem | null {
        options = options || {}

        if (
            options.depth !== undefined &&
            options.attributes &&
            options.attributes.indexOf('size') !== -1
        ) {
            throw new Error(
                'usage of size attribute with depth option is prohibited',
            )
        }

        const name = nodePath.basename(path)
        const normalizedPath = options.normalizePath
            ? normalizePath(path)
            : path
        const item: DirectoryTreeItem = { path: normalizedPath, name }
        let stats: Stats
        let lstat: Stats

        try {
            stats = FS.statSync(path)
            lstat = FS.lstatSync(path)
        } catch (e) {
            return null
        }

        if (options.exclude) {
            const excludes = isRegExp(options.exclude)
                ? [options.exclude]
                : options.exclude
            if (excludes.some((exclusion) => exclusion.test(path))) {
                return null
            }
        }

        if (stats.isFile()) {
            const ext = nodePath.extname(path).toLowerCase()

            if (options.extensions && !options.extensions.test(ext)) return null

            if (options.attributes) {
                options.attributes.forEach((attribute) => {
                    switch (attribute) {
                        case 'extension':
                            item.extension = ext
                            break
                        case 'type':
                            item.type = constants.FILE
                            break
                        default:
                            item[attribute] = stats[attribute]
                            break
                    }
                })
            }

            if (onEachFile) {
                onEachFile(item, path, stats)
            }
        } else if (stats.isDirectory()) {
            const dirData = safeReadDirSync(path)
            if (dirData === null) return null

            if (options.depth === undefined || options.depth > currentDepth) {
                item.children = dirData
                    .map((child) =>
                        directoryTree(
                            nodePath.join(path, child),
                            options,
                            onEachFile,
                            onEachDirectory,
                            currentDepth + 1,
                        ),
                    )
                    .filter((e): e is DirectoryTreeItem => !!e)
            }

            if (options.attributes) {
                options.attributes.forEach((attribute) => {
                    switch (attribute) {
                        case 'size':
                            item.size =
                                item.children?.reduce(
                                    (prev, cur) => prev + (cur.size || 0),
                                    0,
                                ) || 0
                            break
                        case 'type':
                            item.type = constants.DIRECTORY
                            break
                        case 'extension':
                            break
                        default:
                            item[attribute] = stats[attribute]
                            break
                    }
                })
            }

            if (onEachDirectory) {
                onEachDirectory(item, path, stats)
            }
        } else {
            return null
        }
        return item
    }
    return directoryTree('/')
}
