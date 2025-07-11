import { ToolUIPart, UIMessage } from 'ai'
import {
    SearchDocsInput,
    GoToPageInput,
    GetCurrentPageInput,
    FetchUrlInput,
    SelectTextInput,
} from './spiceflow-docs-app'

export type DocsTools = {
    searchDocs: {
        input: SearchDocsInput
        output: any
    }
    goToPage: {
        input: GoToPageInput
        output: {
            slug: string
            error?: string
        }
    }
    getCurrentPage: {
        input: GetCurrentPageInput
        output: any
    }
    fetchUrl: {
        input: FetchUrlInput
        output: any
    }
    selectText: {
        input: SelectTextInput
        output: {
            slug: string
            startLine?: number
            endLine?: number
            error?: string
        }
    }
}

export type DocsUIMessage = UIMessage<never, never, DocsTools>

export type DocsToolPart = { output?: any } & ToolUIPart<DocsTools>
