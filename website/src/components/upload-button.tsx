

import { UploadIcon } from 'lucide-react'
import { ComponentPropsWithoutRef, useState, useRef } from 'react'
import { v4 } from 'uuid'
import { UPLOADS_BASE_URL, uploadBucketName } from 'db/env'
import { useThrowingFn } from 'website/src/lib/hooks'

import { createUploadUrl } from 'website/src/pages/api/functions'
import { Button } from './ui/button'

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
    const [filename, setFilename] = useState('')

    const inputRef = useRef<any>()
    const { fn: up, isLoading } = useThrowingFn({
        async fn(file) {
            const filename = encodeURIComponent(
                slugKebabCase(`${v4()}-${file.name || 'image'}`),
            )

            const { signedUrl, token, path } = await createUploadUrl({
                filename,
            })
            const supabase = createPagesBrowserClient()
            const { data, error } = await supabase.storage
                .from(uploadBucketName)
                .uploadToSignedUrl(path, token, file)
            if (error) {
                console.error(error)
                throw new Error('Error uploading file')
            }
            const src = new URL(data?.path!, UPLOADS_BASE_URL).toString()
            onUploadFinished({ src })
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
            {/* @ts-ignore */}
            <Button
                onClick={() => {
                    inputRef.current.click()
                }}
                isLoading={isLoading}
                endContent={<UploadIcon className='w-4' />}
                className='my-4'
                {...rest}
                // isLoading={isLoading}
            >
                {children || 'Upload File'}
            </Button>
            {/* <div className="mt-2 text-sm opacity-60">{filename}</div> */}
        </>
    )
}
