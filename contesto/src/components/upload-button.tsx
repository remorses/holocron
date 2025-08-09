import { ComponentPropsWithoutRef, useRef, useState } from 'react'
import { Button } from './ui/button.js'

export interface UploadButtonProps {
    bg?: string
    children?: React.ReactNode
    accept?: string
    onUploadFinished: (data: { src: string }) => void
    uploadFunction: (file: File) => Promise<string>
}

export function UploadButton({
    accept = '*',
    children,
    onUploadFinished,
    uploadFunction,
    ...rest
}: UploadButtonProps & ComponentPropsWithoutRef<typeof Button>) {
    const [filename, setFilename] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const inputRef = useRef<HTMLInputElement>(null)

    const handleUpload = async (file: File) => {
        if (!uploadFunction) {
            // If no upload function provided, just return a mock URL
            console.warn('No upload function provided to UploadButton')
            onUploadFinished({ src: URL.createObjectURL(file) })
            return
        }

        setIsLoading(true)
        try {
            const url = await uploadFunction(file)
            onUploadFinished({ src: url })
        } catch (error) {
            console.error('Upload failed:', error)
        } finally {
            setIsLoading(false)
        }
    }

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
                    await handleUpload(file)
                }}
                accept={accept}
                ref={inputRef}
                style={{ display: 'none' }}
            />

            <Button
                onClick={() => {
                    inputRef.current?.click()
                }}
                isLoading={isLoading}
                className=''
                {...rest}
            >
                {children || 'Upload File'}
            </Button>
            {filename && (
                <div className='mt-1 text-sm opacity-60'>{filename}</div>
            )}
        </>
    )
}
