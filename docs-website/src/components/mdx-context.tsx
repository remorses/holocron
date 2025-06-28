import React, { createContext, useContext } from 'react'

export type mdxRenderContext = {
    parentTags: string[]
}

export const mdxParentsContext = createContext<mdxRenderContext>({
    parentTags: [],
})

type MdxParentsProviderProps = {
    tag: string
    children: React.ReactNode
}

export const MdxParentsProvider: React.FC<MdxParentsProviderProps> = ({
    tag,
    children,
}) => {
    const ctx = useContext(mdxParentsContext)
    const parentTags = ctx?.parentTags?.length
        ? [...ctx.parentTags, tag]
        : [tag]

    return (
        <mdxParentsContext.Provider value={{ parentTags }}>
            {children}
        </mdxParentsContext.Provider>
    )
}
