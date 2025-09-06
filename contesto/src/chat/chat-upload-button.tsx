import { RiAddLine, RiAttachment2, RiCloseLine } from '@remixicon/react'
import { forwardRef, useRef, useState } from 'react'

import { Button } from '../components/ui/button.js'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../components/ui/popover.js'

import { createIdGenerator } from 'ai'

interface UploadedFile {
  url: string
  name: string
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
  onFilesChange,
  onUpload,
  accept = '*',
}: {
  onFilesChange?: (files: UploadedFile[]) => void
  onUpload?: (file: File) => Promise<UploadedFile>
  accept?: string
}) {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
  const [isPopoverOpen, setIsPopoverOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const idGenerator = createIdGenerator()
  const [isLoading, setIsLoading] = useState(false)

  const uploadFile = async (file: File) => {
    try {
      setIsLoading(true)

      let newFile: UploadedFile

      if (onUpload) {
        newFile = await onUpload(file)
      } else {
        const contentType = file.type || 'application/octet-stream'
        const finalUrl = URL.createObjectURL(file)

        newFile = {
          name: file.name,
          url: finalUrl,
          contentType,
        }
      }

      const newFiles = [...uploadedFiles, newFile]
      setUploadedFiles(newFiles)
      onFilesChange?.(newFiles)
    } catch (err) {
      console.error(err)
      return err
    } finally {
      setIsLoading(false)
    }
  }

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

  const removeFile = (name: string) => {
    const newFiles = uploadedFiles.filter((f) => f.name !== name)
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

              {uploadedFiles.map((file, index) => (
                <div
                  key={file.name + index}
                  className='flex items-center justify-between px-3 py-2 text-sm hover:bg-muted rounded-md'
                >
                  <span className='truncate flex-1 mr-2'>{file.name}</span>
                  <button
                    className='p-0 cursor-pointer'
                    onClick={() => removeFile(file.name)}
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
        <AttachmentButton onClick={handleAttachClick} disabled={isLoading} />
      )}
    </>
  )
}

function splitExtension(str: string): {
  base: string
  extension: string
} {
  const lastSlash = str.lastIndexOf('/')
  const lastDot = str.lastIndexOf('.')
  // Extension must come after the last slash and dot is not the first character after slash.
  if (lastDot > lastSlash + 1) {
    return {
      base: str.substring(0, lastDot),
      extension: str.substring(lastDot),
    }
  }
  return { base: str, extension: '' }
}

function slugKebabCaseKeepExtension(str: string): string {
  const { base, extension } = splitExtension(str)
  // slugify base path
  let slug = base
    .toLowerCase()
    .split('/')
    .map((segment) => segment.split(' ').filter(Boolean).join('-'))
    .join('-')
    .replace(/-+/g, '-') // collapse multiple dashes
  if (slug.endsWith('-')) slug = slug.slice(0, -1)
  // Just concat extension if exists; keep as is because prompt says "keep it as is"
  return slug + extension
}
