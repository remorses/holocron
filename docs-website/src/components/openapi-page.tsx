import {
    getContext,
    OperationItem,
    WebhookItem,
} from 'fumadocs-openapi/render/api-page'
import Slugger from 'github-slugger'
import { Operation } from 'fumadocs-openapi/render/operation/index'
import type { RenderContext } from 'fumadocs-openapi/types'
import { createMethod } from 'fumadocs-openapi/server/create-method'
import { createRenders, type Renderer } from 'fumadocs-openapi/render/renderer'
import type { OpenAPIV3_1 } from 'openapi-types'
import {
    type DocumentInput,
    processDocument,
    type ProcessedDocument,
} from 'fumadocs-openapi/utils/process-document'
import type { defaultAdapters } from 'fumadocs-openapi/media/adapter'
import { Route } from '../routes/+types/_catchall.$'

export function OpenAPIPage(props: {
    openapiDocument: any
    hasHead: boolean

    renderer?: Partial<Renderer>

    operations?: OperationItem[]

    webhooks?: WebhookItem[]
}) {
    const { openapiDocument: processed, operations = [], webhooks = [], hasHead } = props
    const ctx = getContext(processed, props)
    const { document } = processed
    return (
        <ctx.renderer.Root ctx={ctx}>
            {operations?.map((item) => {
                const pathItem = document.paths?.[item.path]
                if (!pathItem)
                    throw new Error(
                        `[Fumadocs OpenAPI] Path not found in OpenAPI schema: ${item.path}`,
                    )

                const operation = pathItem[item.method]
                if (!operation)
                    throw new Error(
                        `[Fumadocs OpenAPI] Method ${item.method} not found in operation: ${item.path}`,
                    )

                const method = createMethod(item.method, pathItem, operation)

                return (
                    <Operation
                        key={`${item.path}:${item.method}`}
                        method={method}
                        path={item.path}
                        ctx={ctx}
                        hasHead={hasHead}
                    />
                )
            })}
            {webhooks?.map((item) => {
                const webhook = document.webhooks?.[item.name]
                if (!webhook)
                    throw new Error(
                        `[Fumadocs OpenAPI] Webhook not found in OpenAPI schema: ${item.name}`,
                    )

                const hook = webhook[item.method]
                if (!hook)
                    throw new Error(
                        `[Fumadocs OpenAPI] Method ${item.method} not found in webhook: ${item.name}`,
                    )

                const method = createMethod(item.method, webhook, hook)

                return (
                    <Operation
                        type='webhook'
                        key={`${item.name}:${item.method}`}
                        method={method}
                        ctx={ctx}
                        path={`/${item.name}`}
                        hasHead={hasHead}
                    />
                )
            })}
        </ctx.renderer.Root>
    )
}
