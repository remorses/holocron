import { ToolUIPart, UIMessage } from 'ai'
import { type WebsiteTools } from './spiceflow-generate-message'
import { type TodoWriteResponse, type TodoReadResponse, type TodoInfo } from 'contesto/src/lib/todo-tool'

export type GithubState = {
  next?: string
}

// data passed back to framer after login, to tell it what org to use
export type GithubLoginRequestData = {
  githubAccountLogin: string
}

export type WebsiteUIMessage = UIMessage<never, never, WebsiteTools>

export type WebsiteToolPart = { output?: any } & ToolUIPart<WebsiteTools>

export type { TodoWriteResponse, TodoReadResponse, TodoInfo }
