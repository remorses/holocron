import { ToolUIPart, UIMessage } from 'ai'
import {
  type DocsTools,
  type SearchDocsInput,
  type GoToPageInput,
  type GetCurrentPageInput,
  type FetchUrlInput,
  type SelectTextInput,
} from 'website/src/lib/shared-docs-tools'
import { type TodoWriteResponse, type TodoReadResponse } from 'contesto/src/lib/todo-tool'

export type {
  DocsTools,
  SearchDocsInput,
  GoToPageInput,
  GetCurrentPageInput,
  FetchUrlInput,
  SelectTextInput,
  TodoWriteResponse,
  TodoReadResponse,
}

export type DocsUIMessage = UIMessage<never, never, DocsTools>

export type DocsToolPart = { output?: any } & ToolUIPart<DocsTools>
