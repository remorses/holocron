import { ToolUIPart, UIMessage, UITools } from 'ai'
import { type WebsiteTools } from './spiceflow-generate-message'

export type GithubState = {
    next?: string
}

export type WebsiteUIMessage = UIMessage<never, never, WebsiteTools>

export type WebsiteToolPart = {output?: any} & ToolUIPart<WebsiteTools>
