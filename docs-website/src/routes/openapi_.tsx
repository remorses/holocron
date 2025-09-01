import { APIPageInner } from 'fumadocs-openapi/render/api-page-inner'
import { processDocument } from 'fumadocs-openapi/utils/process-document'

const document = {
    openapi: '3.0.0',
    info: {
        title: 'Simple API',
        version: '1.0.0',
        description: 'A simple OpenAPI document example.',
    },
    paths: {
        '/hello': {
            get: {
                summary: 'Say hello',
                responses: {
                    '200': {
                        description: 'A hello message',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        message: { type: 'string' },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        },
    },
}



export const loader = async ({ params, request }) => {
    const processed = await processDocument(document as any, )
    return { processed }
}
import React, { Suspense } from 'react'
export const Page = ({ loaderData: { processed } }) => {
    return (
        <div className='p-[100px] prose flex-col'>
            <Suspense fallback={<div>Loading API documentation...</div>}>
                <APIPageInner
                    operations={[
                        {
                            method: 'get' as any,
                            path: '/hello',
                        },
                    ]}
                    processed={processed}
                    hasHead={false}
                />
            </Suspense>
        </div>
    )
}

export default Page
