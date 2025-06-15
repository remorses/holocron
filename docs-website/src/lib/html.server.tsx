import { SafeMdxRenderer } from 'safe-mdx'
import domSerializer from 'dom-serializer'
import * as domutils from 'domutils'
import DomHandler from 'domhandler'
import { Parser } from 'htmlparser2'
import { mdxComponents } from '../components/mdx-components'
import dom from 'react-dom/server.node'
import { notifyError } from './errors'
import { isAbsoluteUrl } from './utils'

export async function extractAssetsUrls({ ast, extension }) {
    const jsx = <SafeMdxRenderer components={mdxComponents} mdast={ast} />
    const html = dom.renderToStaticMarkup(jsx)
}

export async function processHtml({
    basePath,
    allAssetPaths,
    pagePath,
    html,
    mapImageUrl,
}) {
    if (!html) {
        return {
            html: '<html></html>',
            title: '',
        }
    }
    let imagesNotFound = [] as string[]

    let title = ''
    // Parse HTML
    const handler = new DomHandler(async (error, dom) => {
        if (error) {
            throw error
        }

        // Find first h1 and check for html tag
        const walk = (nodes: any[]) => {
            for (const node of nodes) {
                if (node.type === 'tag') {
                    if (node.name === 'h1') {
                        const textNode = node.children[0]
                        if (textNode?.type === 'text') {
                            title = textNode.data
                            break
                        }
                    }
                }

                if (node.children) {
                    walk(node.children)
                }
            }
        }
        walk(dom)
    })

    const parser = new Parser(handler, { decodeEntities: false })
    parser.write(html)
    parser.end()

    let mediaPaths = [] as string[]
    // Process links and images
    const processNodes = async (nodes: any[]) => {
        for (const [index, node] of nodes.slice().entries()) {
            if (node.type === 'tag') {
                // Handle tags with 'src' attributes (e.g., img, video, audio, source, iframe, script)
                const tagsWithSrc = ['img', 'video', 'audio']
                if (tagsWithSrc.includes(node.name)) {
                    try {
                        const src = node.attribs?.src
                        if (!src) {
                            console.log('no src found for img')
                            domutils.removeElement(node)
                            continue
                        }

                        const imgPath = findMatchInPaths({
                            filePath: src,
                            paths: allAssetPaths,
                        })
                        if (!imgPath) {
                            imagesNotFound.push(src)
                            console.log(`image not found in repo: ${src}`)
                            domutils.removeElement(node)
                            continue
                        }
                        if (!isAbsoluteUrl(imgPath)) {
                            console.log(
                                `replaced link img from ${JSON.stringify(src)} to ${JSON.stringify(imgPath)}`,
                            )

                            mediaPaths.push(imgPath)
                            // node.attribs.src = newSrc
                        }
                    } catch (e) {
                        notifyError(e, 'error transforming image src')
                        // Remove the image node
                        domutils.removeElement(node)
                    }
                }

                if (node.children) {
                    await processNodes(node.children)
                }
            }
        }
    }

    await processNodes(handler.dom)

    if (imagesNotFound.length) {
        console.log(
            `${imagesNotFound.length} images not found in ${pagePath}:`,
            imagesNotFound,
        )
    }
}

export function findMatchInPaths({
    filePath,
    paths,
}: {
    paths: string[]
    filePath: string
}) {
    // hashes are alright
    if (!filePath) {
        return ''
    }
    if (isAbsoluteUrl(filePath)) {
        return filePath
    }
    const normalized = normalizeFilePathForSearch(filePath)
    let found = paths.find((x) => {
        if (x === normalized) {
            return true
        }
        if (x.endsWith(normalized)) {
            return true
        }
        return false
    })
    return found || ''
}

function normalizeFilePathForSearch(filePath: string) {
    if (filePath.startsWith('/')) {
        filePath = filePath.slice(1)
    }
    let parts = filePath.split('/').filter(Boolean)
    // remove relative parts
    parts = parts.filter((x) => {
        if (x === '.') {
            return false
        }
        if (x === '..') {
            return false
        }
        return true
    })
    return parts.join('/')
}
