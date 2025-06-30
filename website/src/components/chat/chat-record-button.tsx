'use client'

import { useState, useRef, useEffect } from 'react'
import { Visualizer } from 'react-sound-visualizer'
import { Button } from 'website/src/components/ui/button'
import { MicIcon, StopCircleIcon, XIcon, Loader2Icon } from 'lucide-react'
import { motion, AnimatePresence } from 'unframer'
import { useChatState } from 'website/src/components/chat/chat-provider'
import { cn } from 'website/src/lib/cn'

interface RecordButtonProps {
    transcribeAudio: (audioFile: File) => Promise<string>
}

export function ChatRecordButton({ transcribeAudio }: RecordButtonProps) {
    const [isRecording, setIsRecording] = useState(false)
    const [audio, setAudio] = useState<MediaStream | null>(null)
    const [isTranscribing, setIsTranscribing] = useState(false)
    const mediaRecorderRef = useRef<MediaRecorder | null>(null)
    const chunksRef = useRef<Blob[]>([])
    const [isDark, setIsDark] = useState(false)

    useEffect(() => {
        // Check if any ancestor has 'dark' class
        const checkDarkMode = () => {
            const element = document.querySelector('.record-button-container')
            if (element) {
                const hasDarkAncestor = element.closest('.dark') !== null
                setIsDark(hasDarkAncestor)
            }
        }

        checkDarkMode()
        // Listen for class changes
        const observer = new MutationObserver(checkDarkMode)
        observer.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ['class'],
            subtree: true,
        })

        return () => observer.disconnect()
    }, [])

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: true,
                video: false,
            })
            setAudio(stream)
            setIsRecording(true)

            // Create MediaRecorder to capture audio
            const mediaRecorder = new MediaRecorder(stream)
            mediaRecorderRef.current = mediaRecorder
            chunksRef.current = []

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    chunksRef.current.push(event.data)
                }
            }

            mediaRecorder.onstop = async () => {
                // Stop all tracks to ensure recording indicator is removed
                if (audio) {
                    audio.getTracks().forEach((track) => {
                        track.stop()
                    })
                }
                
                // Create audio blob from chunks
                const audioBlob = new Blob(chunksRef.current, {
                    type: 'audio/webm',
                })
                await handleTranscription(audioBlob)
            }

            mediaRecorder.start()
        } catch (error) {
            console.error('Error accessing microphone:', error)
            alert('Unable to access microphone. Please check your permissions.')
        }
    }

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop()

            // Stop all tracks to remove recording indicator
            if (audio) {
                audio.getTracks().forEach((track) => {
                    track.stop()
                })
            }

            setIsRecording(false)
            setAudio(null)
            mediaRecorderRef.current = null
        }
    }

    const handleTranscription = async (audioBlob: Blob) => {
        setIsTranscribing(true)
        try {
            const audioFile = new File([audioBlob], 'recording.webm', {
                type: 'audio/webm',
            })
            const text = await transcribeAudio(audioFile)

            // Add transcribed text to chat input
            if (text) {
                const currentText = useChatState.getState().text || ''
                const newText = currentText + (currentText ? ' ' : '') + text
                useChatState.setState({ text: newText })
            }
        } catch (error) {
            console.error('Transcription error:', error)
            // Silently ignore errors as requested
        } finally {
            setIsTranscribing(false)
        }
    }

    return (
        <div className='record-button-container'>
            <Button
                variant='ghost'
                size='icon'
                className='text-popover-foreground'
                onClick={startRecording}
                disabled={isRecording || isTranscribing}
            >
                <MicIcon className='size-5' size={20} aria-hidden='true' />
            </Button>

            <AnimatePresence>
                {(isRecording || isTranscribing) && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className='absolute inset-0 bg-background/95 backdrop-blur-sm z-50 flex items-center justify-center rounded-[20px] overflow-hidden'
                    >
                        <div className='w-full h-full flex flex-col items-center justify-center gap-4 p-4'>
                            {isRecording ? (
                                <>
                                    <div className='text-sm text-foreground/70 font-medium'>
                                        Recording...
                                    </div>

                                    <div className='w-full max-w-md h-24'>
                                        <Visualizer
                                            audio={audio}
                                            strokeColor={
                                                isDark
                                                    ? 'white'
                                                    : 'hsl(var(--foreground))'
                                            }
                                            autoStart={true}
                                        >
                                            {({ canvasRef }) => (
                                                <canvas
                                                    ref={canvasRef}
                                                    className='w-full h-full'
                                                    style={{
                                                        width: '100%',
                                                        height: '100%',
                                                    }}
                                                />
                                            )}
                                        </Visualizer>
                                    </div>

                                    <div className='flex gap-2'>
                                        <Button
                                            variant='default'
                                            size='sm'
                                            autoFocus
                                            className='rounded-full'
                                            onClick={stopRecording}
                                        >
                                            {/* <StopCircleIcon className='size-4 mr-1' /> */}
                                            Stop Recording
                                        </Button>
                                    </div>
                                </>
                            ) : (
                                <div className='flex flex-col items-center gap-3'>
                                    <Loader2Icon className='size-8 text-primary animate-spin' />
                                    <div className='text-sm text-muted-foreground font-medium'>
                                        Transcribing audio...
                                    </div>
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}
