import { createIdGenerator } from 'ai'
import { useChatContext } from 'contesto/src/chat/chat-provider'
import { Dot } from 'docs-website/src/components/chat-tool-previews'
import { useShouldHideBrowser } from '../lib/hooks'
import { cn } from '../lib/utils'
import { flushSync } from 'react-dom'

function TodoItem({
    children: userMessage,
    className = '',
    isFirst = false,
    ...props
}: {
    children: string
    className?: string
    isFirst?: boolean
    onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void
}) {
    const { setDraftText } = useChatContext()
    return (
        <button
            className={`ml-4 ${className} hover:text-blue-300 hover:bg-purple-900/20 px-2 py-1 rounded-md text-start transition-colors cursor-pointer group`}
            onClick={(e) => {
                if (props.onClick) props.onClick(e)
                if (userMessage) {
                    const generateId = createIdGenerator()
                    const id = generateId()

                    flushSync(() => {
                        setDraftText(userMessage)
                    })
                    window.dispatchEvent(new CustomEvent('chatRegenerate'))
                }
            }}
        >
            <span className='inline-block group-hover:text-purple-400 text-purple-200'>
                <span className={cn('inline group-hover:hidden ')}>
                    {isFirst ? '⎿ [ ] ' : '   [ ] '}
                </span>
                <span className={cn('hidden group-hover:inline ')}>
                    {isFirst ? '⎿ [x] ' : '   [x] '}
                </span>
            </span>
            {userMessage}
        </button>
    )
}

function TodosActions() {
    const isOnboardingChat = useShouldHideBrowser()

    const onboardingItems = [
        'Create a docs website for my company',
        'Add a custom domain for the docs site',
        'Add a new page about the company mission',
        'Customize the colors of the website',
    ]

    const updateItems = [
        'Add a new page to my docs based on a web research',
        'Add icons to all the pages',
        'Remove a page from the docs',
        'Add tables to docs pages that contain complex tabular information',
    ]

    const items = isOnboardingChat ? onboardingItems : updateItems
    const greeting = isOnboardingChat
        ? 'Hi! I am Fumabase, your AI docs assistant'
        : "Hi! I'm ready to help update your docs"
    const subtitle = isOnboardingChat
        ? 'Things you can do with Fumabase:'
        : 'Try these powerful doc enhancements:'

    return (
        <div className='leading-snug font-mono text-sm whitespace-pre-wrap break-all gap-[0.1em] flex flex-col items-start'>
            <div>
                <Dot /> {greeting}
            </div>
            <div>
                <Dot /> {subtitle}
            </div>
            <div className='flex flex-col items-start'>
                {items.map((item, index) => (
                    <TodoItem key={index} isFirst={index === 0}>
                        {item}
                    </TodoItem>
                ))}
            </div>
        </div>
    )
}

const Banner = () => (
    <pre className='font-mono text-xs leading-tight mb-4 text-center text-purple-200'>
        {[
            '  ███████╗██╗   ██╗███╗   ███╗ █████╗ ██████╗  █████╗ ███████╗███████╗',
            '  ██╔════╝██║   ██║████╗ ████║██╔══██╗██╔══██╗██╔══██╗██╔════╝██╔════╝',
            '  █████╗  ██║   ██║██╔████╔██║███████║██████╔╝███████║███████╗█████╗  ',
            '  ██╔══╝  ██║   ██║██║╚██╔╝██║██╔══██║██╔══██╗██╔══██║╚════██║██╔══╝  ',
            '  ██║     ╚██████╔╝██║ ╚═╝ ██║██║  ██║██████╔╝██║  ██║███████║███████╗',
            '  ╚═╝      ╚═════╝ ╚═╝     ╚═╝╚═╝  ╚═╝╚═════╝ ╚═╝  ╚═╝╚══════╝╚══════╝',
        ].join('\n')}
    </pre>
)

export function WelcomeMessage() {
    const { messages } = useChatContext()
    if (messages.length) return null
    return (
        <div className='text-mono font-mono text-sm w-auto items-center flex flex-col -mt-[160px]'>
            <Banner />
            <TodosActions />
        </div>
    )
}
