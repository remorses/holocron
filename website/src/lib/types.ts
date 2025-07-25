import { ToolUIPart, UIMessage, UITools } from 'ai'
import { type WebsiteTools } from './spiceflow-generate-message'

export type GithubState = {
    next?: string
}

// data passed back to framer after login, to tell it what org to use
export type GithubLoginRequestData = {
    githubAccountLogin: string
}

export type WebsiteUIMessage = UIMessage<never, never, WebsiteTools>

export type WebsiteToolPart = {output?: any} & ToolUIPart<WebsiteTools>
