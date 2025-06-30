import { UploadIcon } from 'lucide-react'
import { ComponentPropsWithoutRef, useState, useRef } from 'react'
import { useRouteLoaderData } from 'react-router'
import { v4 } from 'uuid'

import { useThrowingFn } from 'website/src/lib/hooks'
import type { Route as ChatRoute } from 'website/src/routes/org.$orgId.site.$siteId.chat.$chatId'
import type { Route as SiteRoute } from 'website/src/routes/org.$orgId.site.$siteId'

import { Button } from './ui/button'
import { apiClient } from '../lib/spiceflow-client'
import { slugKebabCase } from '../lib/utils'
import { env } from '../lib/env'

export function UploadButton({
    accept = '*',
    children,
    onUploadFinished,
    ...rest
}: {
    bg?: string
    children?: React.ReactNode
    accept?: string
    onUploadFinished: (data: { src: string }) => void
} & ComponentPropsWithoutRef<typeof Button>) {
    const chatData = useRouteLoaderData(
        'routes/org.$orgId.site.$siteId.chat.$chatId',
    ) as ChatRoute.ComponentProps['loaderData']

    const branchId = chatData.branchId
    const siteId = chatData.siteId
    const [filename, setFilename] = useState('')

    const inputRef = useRef<any>(undefined)
    const { fn: up, isLoading } = useThrowingFn({
        async fn(file) {
            if (!branchId) {
                throw new Error('No branch available for upload')
            }

            const filename = encodeURIComponent(
                slugKebabCase(`${v4()}-${file.name || 'image'}`),
            )
            const contentType = file.type
            const { error, data } =
                await apiClient.api.createUploadSignedUrl.post({
                    siteId,
                    files: [{ slug: filename, contentType, contentLength: file.size }],
                })
            if (error) throw error

            const { signedUrl, finalUrl } = data.files[0]
            // Do a PUT to the signed URL
            const uploadResp = await fetch(signedUrl, {
                method: 'PUT',
                headers: {
                    'Content-Type': contentType,
                },
                body: file,
            })
            if (!uploadResp.ok) {
                throw new Error('Failed to upload file to storage.')
            }
            if (error) {
                console.error(error)
                throw new Error('Error uploading file')
            }

            onUploadFinished({ src: finalUrl })
        },
    })
    return (
        <>
            <input
                type='file'
                hidden
                onChange={async (e) => {
                    const target: HTMLInputElement = e.target
                    const file = target.files?.[0]

                    if (!file) {
                        console.log('no file')
                        return
                    }
                    setFilename(file.name)
                    await up(file)
                }}
                accept={accept}
                ref={inputRef}
                style={{ display: 'none' }}
            />

            <Button
                onClick={() => {
                    inputRef.current.click()
                }}
                isLoading={isLoading}
                className='my-4'
                {...rest}
                // isLoading={isLoading}
            >
                {children || 'Upload File'}
            </Button>
            <div className="mt-1 text-sm opacity-60">{filename}</div>
        </>
    )
}
