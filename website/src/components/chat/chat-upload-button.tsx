import { RiAttachment2, RiCloseLine, RiAddLine } from '@remixicon/react'
import { useState, useRef } from 'react'
import { v4 } from 'uuid'

import { Button } from '../ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover'
import { apiClient } from '../../lib/spiceflow-client'
import { slugKebabCase } from '../../lib/utils'
import { cn } from '../../lib/cn'
import { useThrowingFn } from '../../lib/hooks'

interface UploadedFile {
    id: string
    name: string
    url: string
    contentType: string
}

function AttachmentButton({
    count,
    onClick,
    disabled,
}: {
    count?: number
    onClick: () => void
    disabled?: boolean
}) {
    return (
        <Button
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
}

export function ChatUploadButton({
    siteId,
    onFilesChange,
}: {
    siteId: string
    onFilesChange?: (files: UploadedFile[]) => void
}) {
    const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
    const [isPopoverOpen, setIsPopoverOpen] = useState(false)
    const inputRef = useRef<HTMLInputElement>(null)

    const { fn: uploadFile, isLoading } = useThrowingFn({
        async fn(file: File) {
            const filename = encodeURIComponent(
                slugKebabCase(`${v4()}-${file.name || 'file'}`),
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

            const { signedUrl, finalUrl } = data.files[0]

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
                id: v4(),
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
        const file = e.target.files?.[0]
        if (!file) return

        await uploadFile(file)

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
                onChange={handleFileSelect}
                style={{ display: 'none' }}
                accept='*'
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
                                <RiAddLine className='h-4 w-4' />
                            </div>

                            {uploadedFiles.map((file) => (
                                <div
                                    key={file.id}
                                    className='flex items-center justify-between px-3 py-2 text-sm hover:bg-muted rounded-md'
                                >
                                    <span className='truncate flex-1 mr-2'>
                                        {file.name}
                                    </span>
                                    <Button
                                        variant='ghost'
                                        size='icon'
                                        className='size-7 hover:bg-destructive/20'
                                        onClick={() => removeFile(file.id)}
                                    >
                                        <RiCloseLine className='size-7' />
                                    </Button>
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
