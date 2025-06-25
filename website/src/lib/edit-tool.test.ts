import { describe, expect, test } from 'vitest'
import {
    createEditExecute,
    isParameterComplete,
    type FileUpdate
} from './edit-tool'

const filesInDraft: Record<string, FileUpdate> = {}

const mockGetPageContent = async ({ githubPath }: { githubPath: string }) => {
    const mockFiles: Record<string, string> = {
        'test.md': 'line 1\nline 2\nline 3\nline 4',
        'example.txt': 'Hello World\nThis is a test file\nEnd of file',
        'empty.md': '',
    }
    return mockFiles[githubPath]
}

const execute = createEditExecute({
    filesInDraft,
    getPageContent: mockGetPageContent,
})

describe('edit-tool commands', () => {
    test('view command - full file', async () => {
        const result = await execute({
            command: 'view',
            path: 'test.md',
            file_text: null,
            insert_line: null,
            new_str: null,
            old_str: null,
            view_range: null,
        })
        expect(result).toMatchInlineSnapshot(`
      "1: line 1
      2: line 2
      3: line 3
      4: line 4"
    `)
    })

    test('view command - with range', async () => {
        const result = await execute({
            command: 'view',
            path: 'test.md',
            file_text: null,
            insert_line: null,
            new_str: null,
            old_str: null,
            view_range: [2, 3],
        })
        expect(result).toMatchInlineSnapshot(`
      "2: line 2
      3: line 3"
    `)
    })

    test('create command', async () => {
        const result = await execute({
            command: 'create',
            path: 'new-file.md',
            file_text:
                'This is a new file\nWith multiple lines\nCreated by test',
            insert_line: null,
            new_str: null,
            old_str: null,
            view_range: null,
        })
        expect(result).toMatchInlineSnapshot(`
      "This is a new file
      With multiple lines
      Created by test"
    `)
        expect(filesInDraft['new-file.md']).toMatchInlineSnapshot(`
          {
            "addedLines": 3,
            "content": "This is a new file
          With multiple lines
          Created by test",
            "deletedLines": 0,
            "githubPath": "new-file.md",
          }
        `)
    })

    test('str_replace command', async () => {
        const result = await execute({
            command: 'str_replace',
            path: 'test.md',
            file_text: null,
            insert_line: null,
            new_str: 'modified line 2',
            old_str: 'line 2',
            view_range: null,
        })
        expect(result).toMatchInlineSnapshot(`
          "Here is the diff of the changes made

          Index: test.md
          ===================================================================
          --- test.md	
          +++ test.md	
          @@ -1,4 +1,4 @@
           line 1
          -line 2
          +modified line 2
           line 3
           line 4
          "
        `)
        expect(filesInDraft['test.md']).toMatchInlineSnapshot(`
          {
            "addedLines": 1,
            "content": "line 1
          modified line 2
          line 3
          line 4",
            "deletedLines": 1,
            "githubPath": "test.md",
          }
        `)
    })

    test('insert command', async () => {
        const result = await execute({
            command: 'insert',
            path: 'example.txt',
            file_text: null,
            insert_line: 1,
            new_str: 'Inserted line after line 1',
            old_str: null,
            view_range: null,
        })
        expect(result).toMatchInlineSnapshot(`
          "Here is the diff of the changes made:

          Index: example.txt
          ===================================================================
          --- example.txt	
          +++ example.txt	
          @@ -1,3 +1,4 @@
           Hello World
          +Inserted line after line 1
           This is a test file
           End of file
          "
        `)
        expect(filesInDraft['example.txt']).toMatchInlineSnapshot(`
          {
            "addedLines": 1,
            "content": "Hello World
          Inserted line after line 1
          This is a test file
          End of file",
            "deletedLines": 0,
            "githubPath": "example.txt",
          }
        `)
    })

    test('undo_edit command', async () => {
        await execute({
            command: 'str_replace',
            path: 'example.txt',
            file_text: null,
            insert_line: null,
            new_str: 'Changed content',
            old_str: 'Hello World',
            view_range: null,
        })

        const result = await execute({
            command: 'undo_edit',
            path: 'example.txt',
            file_text: null,
            insert_line: null,
            new_str: null,
            old_str: null,
            view_range: null,
        })
        expect(result).toMatchInlineSnapshot(`
      {
        "content": "Hello World
      Inserted line after line 1
      This is a test file
      End of file",
        "message": "Successfully reverted example.txt to previous state.",
        "success": true,
      }
    `)
    })

    test('error cases', async () => {
        const nonExistentResult = await execute({
            command: 'view',
            path: 'non-existent.md',
            file_text: null,
            insert_line: null,
            new_str: null,
            old_str: null,
            view_range: null,
        })
        expect(nonExistentResult).toMatchInlineSnapshot(`""`)

        const duplicateReplaceResult = await execute({
            command: 'str_replace',
            path: 'test.md',
            file_text: null,
            insert_line: null,
            new_str: 'new',
            old_str: 'line',
            view_range: null,
        })
        expect(duplicateReplaceResult).toMatchInlineSnapshot(`
          "Here is the diff of the changes made, notice that you replaced more than one match, if that was not desired undo the change or add back the old content you want to keep

          Index: test.md
          ===================================================================
          --- test.md	
          +++ test.md	
          @@ -1,4 +1,4 @@
          -line 1
          +new 1
           modified line 2
           line 3
           line 4
          "
        `)

        const noMatchReplaceResult = await execute({
            command: 'str_replace',
            path: 'test.md',
            file_text: null,
            insert_line: null,
            new_str: 'new',
            old_str: 'nonexistent',
            view_range: null,
        })
        expect(noMatchReplaceResult).toMatchInlineSnapshot(`
      {
        "error": "No match found for replacement. Old string "nonexistent" not found in the document.",
        "success": false,
      }
    `)

        const undoWithoutEditResult = await execute({
            command: 'undo_edit',
            path: 'never-edited.md',
            file_text: null,
            insert_line: null,
            new_str: null,
            old_str: null,
            view_range: null,
        })
        expect(undoWithoutEditResult).toMatchInlineSnapshot(`
          {
            "content": "new 1
          modified line 2
          line 3
          line 4",
            "message": "Successfully reverted never-edited.md to previous state.",
            "success": true,
          }
        `)
    })

    test('edge cases', async () => {
        const viewEmptyFile = await execute({
            command: 'view',
            path: 'empty.md',
            file_text: null,
            insert_line: null,
            new_str: null,
            old_str: null,
            view_range: null,
        })
        expect(viewEmptyFile).toMatchInlineSnapshot(`""`)

        const viewEndRange = await execute({
            command: 'view',
            path: 'test.md',
            file_text: null,
            insert_line: null,
            new_str: null,
            old_str: null,
            view_range: [3, -1],
        })
        expect(viewEndRange).toMatchInlineSnapshot(`
      "3: line 3
      4: line 4"
    `)

        const insertAtEnd = await execute({
            command: 'insert',
            path: 'test.md',
            file_text: null,
            insert_line: 99,
            new_str: 'line at end',
            old_str: null,
            view_range: null,
        })
        expect(insertAtEnd).toMatchInlineSnapshot(`
          "Here is the diff of the changes made:

          Index: test.md
          ===================================================================
          --- test.md	
          +++ test.md	
          @@ -1,4 +1,5 @@
           new 1
           modified line 2
           line 3
          -line 4
          +line 4
          +line at end
          "
        `)
    })
})

describe('isParameterComplete', () => {
    test('view command validation', () => {
        expect(
            isParameterComplete({ command: 'view', path: 'test.md' }),
        ).toMatchInlineSnapshot(`true`)
        expect(isParameterComplete({ command: 'view' })).toMatchInlineSnapshot(
            `false`,
        )
    })

    test('create command validation', () => {
        expect(
            isParameterComplete({
                command: 'create',
                path: 'new.md',
                file_text: 'content',
            }),
        ).toMatchInlineSnapshot(`true`)
        expect(
            isParameterComplete({ command: 'create', path: 'new.md' }),
        ).toMatchInlineSnapshot(`false`)
    })

    test('str_replace command validation', () => {
        expect(
            isParameterComplete({
                command: 'str_replace',
                path: 'test.md',
                old_str: 'old',
                new_str: 'new',
            }),
        ).toMatchInlineSnapshot(`true`)
        expect(
            isParameterComplete({
                command: 'str_replace',
                path: 'test.md',
                old_str: 'old',
            }),
        ).toMatchInlineSnapshot(`false`)
    })

    test('insert command validation', () => {
        expect(
            isParameterComplete({
                command: 'insert',
                path: 'test.md',
                insert_line: 1,
                new_str: 'content',
            }),
        ).toMatchInlineSnapshot(`true`)
        expect(
            isParameterComplete({
                command: 'insert',
                path: 'test.md',
                insert_line: 1,
            }),
        ).toMatchInlineSnapshot(`false`)
    })

    test('undo_edit command validation', () => {
        expect(
            isParameterComplete({ command: 'undo_edit', path: 'test.md' }),
        ).toMatchInlineSnapshot(`true`)
    })
})
