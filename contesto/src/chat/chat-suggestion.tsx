import { createIdGenerator } from 'ai'
import { flushSync } from 'react-dom'
import { Button } from '../components/ui/button.js'
import { useChatState } from './chat-provider.js'

export function ChatSuggestionButton({
    icon,
    children,
    userMessage,
    ...props
}: {
    icon: React.ReactNode
    children: React.ReactNode
    userMessage: string
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
    return (
        <Button
            variant='ghost'
            {...props}
            className={
                'flex px-2 items-center gap-3 ' + (props.className ?? '')
            }
            onClick={(e) => {
                if (props.onClick) props.onClick(e)
                if (userMessage) {
                    const generateId = createIdGenerator()
                    const id = generateId()

                    flushSync(() => {
                        useChatState.setState({
                            draftText: userMessage,
                        })
                    })
                    window.dispatchEvent(new CustomEvent('chatRegenerate'))
                }
            }}
        >
            {icon}
            {children}
            <svg
                width='16'
                height='16'
                fill='none'
                stroke='currentColor'
                strokeWidth={2}
                className='ml-auto shrink-0'
                viewBox='0 0 16 16'
                aria-hidden='true'
            >
                <path
                    d='M6 4l4 4-4 4'
                    strokeLinecap='round'
                    strokeLinejoin='round'
                />
            </svg>
        </Button>
    )
}
