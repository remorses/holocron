import z from 'zod'
import { diffLines, createPatch } from 'diff'

export function calculateLineChanges(
    oldContent: string,
    newContent: string,
): { addedLines: number; deletedLines: number } {
    const diff = diffLines(oldContent, newContent)
    let addedLines = 0
    let deletedLines = 0

    for (const part of diff) {
        if (part.added) {
            addedLines += part.count || 0
        } else if (part.removed) {
            deletedLines += part.count || 0
        }
    }

    return { addedLines, deletedLines }
}

export type EditToolParamSchema = z.infer<typeof editToolParamsSchema>

export const fileUpdateSchema = z
    .object({
        githubPath: z.string(),
        content: z.string().default(''),
        addedLines: z.number().optional(),
        deletedLines: z.number().optional(),
    })
    .nullable()
export type FileUpdate = z.infer<typeof fileUpdateSchema>


/**
 * DeepPartial<T> makes all properties (and nested properties) of type T optional.
 */
export type DeepPartial<T> = {
    [P in keyof T]?: T[P] extends object
        ? T[P] extends Function
            ? T[P]
            : DeepPartial<T[P]>
        : T[P]
}
export function isParameterComplete(args: DeepPartial<EditToolParamSchema>) {
    if (!args) return false
    const { command, path, file_text, insert_line, new_str, old_str } = args

    if (!command) return false
    if (!path || typeof path !== 'string' || path.length === 0) return false

    switch (command) {
        case 'view':
        case 'undo_edit':
            // Only path and command are required for these commands.
            return true
        case 'create':
            return typeof file_text === 'string' && file_text.length > 0
        case 'insert':
            return (
                typeof insert_line === 'number' &&
                insert_line >= 1 &&
                typeof new_str === 'string' &&
                new_str.length > 0
            )
        case 'str_replace':
            return (
                typeof old_str === 'string' &&
                old_str.length > 0 &&
                typeof new_str === 'string' &&
                new_str.length > 0
            )
        default:
            return false
    }
}

export function createEditExecute({
    filesInDraft,
    getPageContent: _getPageContent,
    validateNewContent,
}: {
    validateNewContent?: (x: { githubPath: string; content: string }) => any
    filesInDraft: Record<string, FileUpdate>
    getPageContent: (x: {
        githubPath: string
    }) => Promise<string | undefined | void>
}) {
    const previousEdits = [] as FileUpdate[]
    const originalContent = new Map<string, string>()

    async function getOriginalContent(path: string): Promise<string> {
        if (originalContent.has(path)) {
            return originalContent.get(path)!
        }
        const content = await _getPageContent({ githubPath: path })
        const contentStr = content || ''
        originalContent.set(path, contentStr)
        return contentStr
    }

    return async function execute(params: EditToolParamSchema) {
        const {
            command,
            path,
            file_text,
            insert_line,
            new_str,
            old_str,
            view_range,
        } = params

        // TODO if a file contents changed since the last read, I should tell the model. so it does not try to update the file with string replacements that are no longer there

        switch (command) {
            case 'view': {
                const override = filesInDraft[path]
                let content: string | null = null

                if (override) {
                    content = override.content
                } else {
                    try {
                        const fetchedContent = await getOriginalContent(path)
                        content = fetchedContent || ''
                        filesInDraft[path] = {
                            githubPath: path,
                            content: content,
                            addedLines: 0,
                            deletedLines: 0,
                        }
                    } catch (e) {
                        return {
                            success: false,
                            error: e.message,
                        }
                    }
                }

                if (!content) {
                    return content
                }

                const lines = content.split('\n')

                if (
                    view_range &&
                    Array.isArray(view_range) &&
                    view_range.length === 2
                ) {
                    const [start, end] = view_range
                    const startIdx = Math.max(start - 1, 0)
                    const endIdx =
                        end === -1 ? lines.length : Math.min(end, lines.length)
                    const selectedLines = lines.slice(startIdx, endIdx)

                    // Add line numbers for the selected range
                    return selectedLines
                        .map((line, index) => {
                            const lineNumber = startIdx + index + 1
                            return `${lineNumber.toString()}: ${line}`
                        })
                        .join('\n')
                }

                // Add line numbers to all lines
                return lines
                    .map((line, index) => {
                        const lineNumber = index + 1
                        return `${lineNumber.toString()}: ${line}`
                    })
                    .join('\n')
            }
            case 'create': {
                if (file_text == null) {
                    return {
                        success: false,
                        error: '`file_text` is required for create command.',
                    }
                }
                if (validateNewContent) {
                    try {
                        const result = await validateNewContent({
                            githubPath: path,
                            content: file_text,
                        })
                        if (result && result.error) {
                            return {
                                success: false,
                                error: `result content is invalid: create: ${result.error}`,
                            }
                        }
                    } catch (e: any) {
                        return {
                            success: false,
                            error: e && e.message ? e.message : String(e),
                        }
                    }
                }
                const lineCount = file_text.split('\n').length
                filesInDraft[path] = {
                    githubPath: path,
                    content: file_text,
                    addedLines: lineCount,
                    deletedLines: 0,
                }
                return file_text
            }
            case 'str_replace': {
                let override = filesInDraft[path]
                if (!override) {
                    const content = await getOriginalContent(path)
                    if (typeof content !== 'string') {
                        return {
                            success: false,
                            error: `Page not found for path: ${path}`,
                        }
                    }
                    override = {
                        githubPath: path,
                        content: content,
                        addedLines: 0,
                        deletedLines: 0,
                    }
                }

                // Ensure we have the original content for comparison
                const original = await getOriginalContent(path)

                // Store current state before editing
                previousEdits.push({
                    githubPath: path,
                    content: override.content,
                    addedLines: override.addedLines || 0,
                    deletedLines: override.deletedLines || 0,
                })
                if (typeof old_str !== 'string' || old_str.length === 0) {
                    return {
                        success: false,
                        error: '`old_str` is required for str_replace command.',
                    }
                }
                if (typeof new_str !== 'string') {
                    return {
                        success: false,
                        error: '`new_str` is required for str_replace command.',
                    }
                }
                const occurrences = override.content.split(old_str).length - 1
                if (occurrences === 0) {
                    return {
                        success: false,
                        error: `No match found for replacement. Old string "${old_str}" not found in the document.`,
                    }
                }
                // if (occurrences > 1) {
                //     return {
                //         success: false,
                //         error: `Old string "${old_str}" found more than once in the document.`,
                //     }
                // }
                const replacedContent = override.content.replace(
                    old_str,
                    new_str,
                )
                if (validateNewContent) {
                    try {
                        const result = await validateNewContent({
                            githubPath: path,
                            content: replacedContent,
                        })
                        if (result && result.error) {
                            return {
                                success: false,
                                error: `result content is invalid: str_replace: ${result.error}`,
                            }
                        }
                    } catch (e: any) {
                        return {
                            success: false,
                            error: e && e.message ? e.message : String(e),
                        }
                    }
                }
                const { addedLines, deletedLines } = calculateLineChanges(
                    original,
                    replacedContent,
                )
                filesInDraft[path] = {
                    githubPath: path,
                    content: replacedContent,
                    addedLines,
                    deletedLines,
                }

                const patch = createPatch(
                    path,
                    override.content,
                    replacedContent,
                    '',
                    '',
                )
                const cleanPatch = patch.replace(
                    /\\ No newline at end of file\n?/g,
                    '',
                )
                let result = `Here is the diff of the changes made`
                if (occurrences > 1) {
                    result += `, notice that you replaced more than one match, if that was not desired undo the change or add back the old content you want to keep`
                }
                result += `\n\n${cleanPatch}`
                return result
            }
            case 'insert': {
                let override = filesInDraft[path]
                if (!override) {
                    const content = await getOriginalContent(path)
                    if (typeof content !== 'string') {
                        return {
                            success: false,
                            error: `Page not found for path: ${path}`,
                        }
                    }
                    override = {
                        githubPath: path,
                        content: content,
                        addedLines: 0,
                        deletedLines: 0,
                    }
                }

                // Ensure we have the original content for comparison
                const original = await getOriginalContent(path)

                // Store current state before editing
                previousEdits.push({
                    githubPath: path,
                    content: override.content,
                    addedLines: override.addedLines || 0,
                    deletedLines: override.deletedLines || 0,
                })
                if (typeof insert_line !== 'number' || insert_line < 1) {
                    return {
                        success: false,
                        error: '`insert_line` (must be >= 1) is required for insert command.',
                    }
                }
                if (typeof new_str !== 'string') {
                    return {
                        success: false,
                        error: '`new_str` is required for insert command.',
                    }
                }
                const lines = override.content.split('\n')
                // insert_line is 1-based, insert after the specified line
                const insertAt = Math.min(insert_line, lines.length)
                lines.splice(insertAt, 0, new_str)
                const newContent = lines.join('\n')
                if (validateNewContent) {
                    try {
                        const result = await validateNewContent({
                            githubPath: path,
                            content: newContent,
                        })
                        if (result && result.error) {
                            return {
                                success: false,
                                error: `result content is invalid: insert: ${result.error}`,
                            }
                        }
                    } catch (e: any) {
                        return {
                            success: false,
                            error: e && e.message ? e.message : String(e),
                        }
                    }
                }
                const { addedLines, deletedLines } = calculateLineChanges(
                    original,
                    newContent,
                )
                filesInDraft[path] = {
                    githubPath: path,
                    content: newContent,
                    addedLines,
                    deletedLines,
                }

                const patch = createPatch(
                    path,
                    override.content,
                    newContent,
                    '',
                    '',
                )
                const cleanPatch = patch.replace(
                    /\\ No newline at end of file\n?/g,
                    '',
                )
                return `Here is the diff of the changes made:\n\n${cleanPatch}`
            }
            case 'undo_edit': {
                const previous = previousEdits.pop()
                if (!previous) {
                    return {
                        success: false,
                        error: `No previous edit found for path: ${path}. Cannot undo.`,
                    }
                }

                // Restore the previous content and recalculate line changes against original
                if (validateNewContent) {
                    try {
                        const result = await validateNewContent({
                            githubPath: path,
                            content: previous.content,
                        })
                        if (result && result.error) {
                            return {
                                success: false,
                                error: `result content is invalid: undo_edit: ${result.error}`,
                            }
                        }
                    } catch (e: any) {
                        return {
                            success: false,
                            error: e && e.message ? e.message : String(e),
                        }
                    }
                }

                const original = await getOriginalContent(path)
                const { addedLines, deletedLines } = calculateLineChanges(
                    original,
                    previous.content,
                )

                filesInDraft[path] = {
                    githubPath: path,
                    content: previous.content,
                    addedLines,
                    deletedLines,
                }

                return {
                    success: true,
                    message: `Successfully reverted ${path} to previous state.`,
                    content: previous.content,
                }
            }
            default: {
                return {
                    success: false,
                    error: `Unknown command: ${command}`,
                }
            }
        }
    }
}

export const editToolDescription = `Update files. Notice that the view command will return text with lines prefixes, these should not be referenced in the str_replace commands or others.`

export const editToolParamsSchema = z.object({
    /**
     * The commands to run. Allowed options are: `view`, `create`, `str_replace`, `insert`, `undo_edit`.
     */
    command: z
        .enum(['view', 'create', 'str_replace', 'insert', 'undo_edit'])
        .describe('The commands to run. This field should always come first'),
    /**
     * Absolute path to file or directory, e.g. `/repo/file.py` or `/repo`.
     */
    path: z
        .string()
        .describe(
            'Absolute path to file or directory, e.g. `repo/file.py` or `repo`. MUST never start with "/". This field should always come second, after command.',
        ),
    /**
     * Required parameter of `create` command, with the content of the file to be created.
     */
    file_text: z
        .string()
        .describe(
            'Required parameter of `create` command, with the content of the file to be created.',
        )
        .nullable(),
    /**
     * Required parameter of `insert` command. The `new_str` will be inserted AFTER the line `insert_line` of `path`.
     */
    insert_line: z
        .number()
        .int()
        .describe(
            'Required parameter of `insert` command. The `new_str` will be inserted AFTER the line `insert_line` of `path`.',
        )
        .nullable(),
    /**
     * Optional parameter of `str_replace` command containing the new string (if not given, no string will be added). Required parameter of `insert` command containing the string to insert.
     */
    new_str: z
        .string()

        .describe(
            'Optional parameter of `str_replace` command containing the new string (if not given, no string will be added). Required parameter of `insert` command containing the string to insert.',
        )
        .nullable(),
    /**
     * Required parameter of `str_replace` command containing the string in `path` to replace.
     */
    old_str: z
        .string()
        .describe(
            'Required parameter of `str_replace` command containing the string in `path` to replace.',
        )
        .nullable(),
    /**
     * Optional parameter of `view` command when `path` points to a file. If none is given, the full file is shown. If provided, the file will be shown in the indicated line number range, e.g. [11, 12] will show lines 11 and 12. Indexing at 1 to start. Setting `[start_line, -1]` shows all lines from `start_line` to the end of the file.
     */
    view_range: z
        .array(z.number())
        .length(2)

        .describe(
            'Optional parameter of `view` command when `path` points to a file. If none is given, the full file is shown. If provided, the file will be shown in the indicated line number range, e.g. [11, 12] will show lines 11 and 12. Indexing at 1 to start. Setting `[start_line, -1]` shows all lines from `start_line` to the end of the file.',
        )
        .nullable(),
})
