import { RiAttachment2, RiCloseLine, RiAddLine } from '@remixicon/react'
import { useState, useRef, forwardRef } from 'react'

import { Button } from '../ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover'
import { apiClient } from '../../lib/spiceflow-client'
import { slugKebabCaseKeepExtension } from '../../lib/utils'
import { cn } from '../../lib/cn'
import { useThrowingFn } from '../../lib/hooks'
import { createIdGenerator } from 'ai'

interface UploadedFile {
    id: string
    name: string
    url: string
    contentType: string
}

const AttachmentButton = forwardRef<
    HTMLButtonElement,
    {
        count?: number
        onClick: () => void
        disabled?: boolean
    }
>(({ count, onClick, disabled }, ref) => {
    return (
        <Button
            ref={ref}
            variant='ghost'
            size='icon'
            className='relative '
            onClick={onClick}
            disabled={disabled}
        >
            <RiAttachment2 className='size-5' />
            {count && count > 0 && (
                <span className='absolute -top-1 left-full min-w-3 -translate-x-2 px-0.5 h-3 rounded-full text-[10px] font-medium flex items-center justify-center border border-background text-foreground'>
                    {count}
                </span>
            )}
        </Button>
    )
})

export function ChatUploadButton({
    siteId,
    onFilesChange,
    accept = '*',
}: {
    siteId: string
    onFilesChange?: (files: UploadedFile[]) => void
    accept?: string
}) {
    const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
    const [isPopoverOpen, setIsPopoverOpen] = useState(false)
    const inputRef = useRef<HTMLInputElement>(null)

    const idGenerator = createIdGenerator()
    const { fn: uploadFile, isLoading } = useThrowingFn({
        async fn(file: File) {
            const filename = encodeURIComponent(
                slugKebabCaseKeepExtension(
                    `${idGenerator()}-${file.name || 'file'}`,
                ),
            )
            const contentType = file.type || 'application/octet-stream'

            console.log(file.size)
            const { error, data } =
                await apiClient.api.createUploadSignedUrl.post({
                    siteId,
                    files: [
                        {
                            slug: filename,
                            contentType,
                            contentLength: file.size,
                        },
                    ],
                })
            if (error) throw error

            const { signedUrl, finalUrl } = data.files[0] || {}

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

            const newFile: UploadedFile = {
                id: idGenerator(),
                name: file.name,
                url: finalUrl,
                contentType,
            }

            const newFiles = [...uploadedFiles, newFile]
            setUploadedFiles(newFiles)
            onFilesChange?.(newFiles)

            // TODO: Wire this logic to messages
        },
    })

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || [])
        if (files.length === 0) return

        for (const file of files) {
            await uploadFile(file)
        }

        if (inputRef.current) {
            inputRef.current.value = ''
        }
    }

    const removeFile = (fileId: string) => {
        const newFiles = uploadedFiles.filter((f) => f.id !== fileId)
        setUploadedFiles(newFiles)
        onFilesChange?.(newFiles)
    }

    const handleAttachClick = () => {
        if (uploadedFiles.length > 0) {
            setIsPopoverOpen(true)
        } else {
            inputRef.current?.click()
        }
    }

    return (
        <>
            <input
                ref={inputRef}
                type='file'
                multiple
                onChange={handleFileSelect}
                style={{ display: 'none' }}
                accept={accept}
            />

            {uploadedFiles.length > 0 && (
                <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
                    <PopoverTrigger asChild>
                        <AttachmentButton
                            count={uploadedFiles.length}
                            onClick={handleAttachClick}
                            disabled={isLoading}
                        />
                    </PopoverTrigger>

                    <PopoverContent className='w-80 p-0' align='start'>
                        <div className='space-y-1 p-1'>
                            <div
                                className='flex items-center justify-between px-3 py-2 text-sm cursor-pointer hover:bg-muted rounded-md'
                                onClick={() => {
                                    inputRef.current?.click()
                                    setIsPopoverOpen(false)
                                }}
                            >
                                <span>add more files</span>
                                <RiAddLine className='size-5' />
                            </div>

                            {uploadedFiles.map((file) => (
                                <div
                                    key={file.id}
                                    className='flex items-center justify-between px-3 py-2 text-sm hover:bg-muted rounded-md'
                                >
                                    <span className='truncate flex-1 mr-2'>
                                        {file.name}
                                    </span>
                                    <button
                                        className='p-0 cursor-pointer'
                                        onClick={() => removeFile(file.id)}
                                    >
                                        <RiCloseLine className='size-5' />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </PopoverContent>
                </Popover>
            )}

            {uploadedFiles.length === 0 && (
                <AttachmentButton
                    onClick={handleAttachClick}
                    disabled={isLoading}
                />
            )}
        </>
    )
}
