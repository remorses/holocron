import z from 'zod'

export type EditToolParamSchema = z.infer<typeof editToolParamsSchema>

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
