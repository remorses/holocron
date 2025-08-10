# Changelog

## 2025-08-10 12:00

- Added `onExecute` callback to `createRenderFormTool` configuration
- Added validation for `updateFumabaseJsonc` tool to ensure fumabase.jsonc file is read before calling
- Wrapped render form tool execution in try-catch to properly return errors

## 2025-08-04 17:49

- Fixed TypeScript errors in process-chat tests by using correct UIMessageChunk types
- Updated error propagation tests to handle AI SDK's error handling behavior correctly
- Replaced invalid chunk type '0' with proper 'text-delta' chunk type

## 2025-08-02 15:30

- Added `onError` parameter to `asyncIterableToReadableStream` function to enable error callbacks
- Updated `uiStreamToUIMessages` to capture errors via closure variable and throw inside the loop when error is captured