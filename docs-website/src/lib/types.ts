import { ToolUIPart, UIMessage } from 'ai'
import {
    type DocsTools,
    type SearchDocsInput,
    type GoToPageInput,
    type GetCurrentPageInput,
    type FetchUrlInput,
    type SelectTextInput,
} from 'website/src/lib/shared-docs-tools'

export type {
    DocsTools,
    SearchDocsInput,
    GoToPageInput,
    GetCurrentPageInput,
    FetchUrlInput,
    SelectTextInput,
}

export type DocsUIMessage = UIMessage<never, never, DocsTools>

export type DocsToolPart = { output?: any } & ToolUIPart<DocsTools>
