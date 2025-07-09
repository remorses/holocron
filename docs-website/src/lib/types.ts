import { ToolUIPart, UIMessage } from 'ai'
import {
    SearchDocsInput,
    GoToPageInput,
    GetCurrentPageInput,
    FetchUrlInput,
} from './spiceflow-docs-app'

export type DocsTools = {
    searchDocs: {
        input: SearchDocsInput
        output: any
    }
    goToPage: {
        input: GoToPageInput
        output: any
    }
    getCurrentPage: {
        input: GetCurrentPageInput
        output: any
    }
    fetchUrl: {
        input: FetchUrlInput
        output: any
    }
}

export type DocsUIMessage = UIMessage<never, never, DocsTools>

export type DocsToolPart = {output?: any} & ToolUIPart<DocsTools>