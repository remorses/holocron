export type TableOfContentsEntry = {
    title: string
    slug: string
    depth: number
    children: TableOfContentsEntry[]
}

export type PagesTree<T = {}> = {
    slug: string
    pageId?: string
    iconUrl?: string
    title?: string

    placeholder?: boolean
    children?: PagesTree<T>[]
} & T


export type VectorAttributes = {
    text: string
    slug: string
}
