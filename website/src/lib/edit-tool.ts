import z from 'zod'

export type EditToolParamSchema = z.infer<typeof editToolParamsSchema>

export type PageUpdate = { githubPath: string; markdown: string }

export function isParameterComplete(args: Partial<EditToolParamSchema>) {
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
    updatedPages,
    getPageContent,
}: {
    updatedPages: Record<string, PageUpdate>
    getPageContent: (x: {
        githubPath: string
    }) => Promise<string | undefined | void>
}) {
    const previousEdits = [] as PageUpdate[]
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

        switch (command) {
            case 'view': {
                const override = updatedPages[path]
                let content: string | null = null

                if (override) {
                    content = override.markdown
                } else {
                    try {
                        const content = await getPageContent({
                            githubPath: path,
                        })
                        updatedPages[path] = {
                            githubPath: path,
                            markdown: content || '',
                        }
                        return content
                    } catch (e) {
                        return {
                            success: false,
                            error: e.message,
                        }
                    }
                }

                if (
                    view_range &&
                    Array.isArray(view_range) &&
                    view_range.length === 2 &&
                    content
                ) {
                    const [start, end] = view_range
                    const lines = content.split('\n')
                    const startIdx = Math.max(start - 1, 0)
                    const endIdx =
                        end === -1 ? lines.length : Math.min(end, lines.length)
                    return lines.slice(startIdx, endIdx).join('\n')
                }

                return content
            }
            case 'create': {
                if (!file_text) {
                    return {
                        success: false,
                        error: '`file_text` is required for create command.',
                    }
                }
                updatedPages[path] = {
                    githubPath: path,
                    markdown: file_text,
                }
                return file_text
            }
            case 'str_replace': {
                const override = updatedPages[path]
                if (!override) {
                    return {
                        success: false,
                        error: `Page not found for path: ${path}`,
                    }
                }

                // Store current state before editing
                previousEdits.push({
                    githubPath: path,
                    markdown: override.markdown,
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
                const occurrences = override.markdown.split(old_str).length - 1
                if (occurrences === 0) {
                    return {
                        success: false,
                        error: `No match found for replacement. Old string "${old_str}" not found in the document.`,
                    }
                }
                if (occurrences > 1) {
                    return {
                        success: false,
                        error: `Old string "${old_str}" found more than once in the document.`,
                    }
                }
                const replacedContent = override.markdown.replace(
                    old_str,
                    new_str,
                )
                updatedPages[path] = {
                    githubPath: path,
                    markdown: replacedContent,
                }
                return replacedContent
            }
            case 'insert': {
                const override = updatedPages[path]
                if (!override) {
                    return {
                        success: false,
                        error: `Page not found for path: ${path}`,
                    }
                }

                // Store current state before editing
                previousEdits.push({
                    githubPath: path,
                    markdown: override.markdown,
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
                const lines = override.markdown.split('\n')
                // insert_line is 1-based, insert after the specified line
                const insertAt = Math.min(insert_line, lines.length)
                lines.splice(insertAt, 0, new_str)
                const newContent = lines.join('\n')
                updatedPages[path] = {
                    githubPath: path,
                    markdown: newContent,
                }
                return newContent
            }
            case 'undo_edit': {
                const previous = previousEdits.pop()
                if (!previous) {
                    return {
                        success: false,
                        error: `No previous edit found for path: ${path}. Cannot undo.`,
                    }
                }

                // Restore the previous content
                updatedPages[path] = {
                    githubPath: path,
                    markdown: previous.markdown,
                }

                return {
                    success: true,
                    message: `Successfully reverted ${path} to previous state.`,
                    content: previous.markdown,
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

export const editToolParamsSchema = z.object({
    /**
     * The commands to run. Allowed options are: `view`, `create`, `str_replace`, `insert`, `undo_edit`.
     */
    command: z
        .enum(['view', 'create', 'str_replace', 'insert', 'undo_edit'])
        .describe(
            'The commands to run. Allowed options are: `view`, `create`, `str_replace`, `insert`, `undo_edit`.',
        ),
    /**
     * Absolute path to file or directory, e.g. `/repo/file.py` or `/repo`.
     */
    path: z
        .string()
        .min(1)
        .max(1000)
        .describe(
            'Absolute path to file or directory, e.g. `/repo/file.py` or `/repo`.',
        ),
    /**
     * Required parameter of `create` command, with the content of the file to be created.
     */
    file_text: z
        .string()
        .min(1)
        .max(100000)
        .optional()
        .describe(
            'Required parameter of `create` command, with the content of the file to be created.',
        ),
    /**
     * Required parameter of `insert` command. The `new_str` will be inserted AFTER the line `insert_line` of `path`.
     */
    insert_line: z
        .number()
        .int()
        .min(1)
        .optional()
        .describe(
            'Required parameter of `insert` command. The `new_str` will be inserted AFTER the line `insert_line` of `path`.',
        ),
    /**
     * Optional parameter of `str_replace` command containing the new string (if not given, no string will be added). Required parameter of `insert` command containing the string to insert.
     */
    new_str: z
        .string()
        .min(1)
        .max(100000)
        .optional()
        .describe(
            'Optional parameter of `str_replace` command containing the new string (if not given, no string will be added). Required parameter of `insert` command containing the string to insert.',
        ),
    /**
     * Required parameter of `str_replace` command containing the string in `path` to replace.
     */
    old_str: z
        .string()
        .min(1)
        .max(100000)
        .optional()
        .describe(
            'Required parameter of `str_replace` command containing the string in `path` to replace.',
        ),
    /**
     * Optional parameter of `view` command when `path` points to a file. If none is given, the full file is shown. If provided, the file will be shown in the indicated line number range, e.g. [11, 12] will show lines 11 and 12. Indexing at 1 to start. Setting `[start_line, -1]` shows all lines from `start_line` to the end of the file.
     */
    view_range: z
        .tuple([z.number().int(), z.number().int()])
        .optional()
        .describe(
            'Optional parameter of `view` command when `path` points to a file. If none is given, the full file is shown. If provided, the file will be shown in the indicated line number range, e.g. [11, 12] will show lines 11 and 12. Indexing at 1 to start. Setting `[start_line, -1]` shows all lines from `start_line` to the end of the file.',
        ),
})
