# Changelog

## 2025-08-15 18:56

- Added URL constructor support in isolated environment using ivm.Callback
- URL properties are explicitly mapped to ensure proper serialization across isolation boundary
- Added test to verify URL functionality with both absolute and relative URL creation

## 2025-08-15 18:43

- Convert tool names to camelCase when injecting into isolated environment and generating TypeScript types
- Updated tests to use inline snapshots for tool descriptions and real-world examples
- Added camelcase package for consistent naming convention

## 2025-08-15 18:40

- Updated `createInterpreterTool` to use Zod v4's built-in `toJSONSchema` function instead of custom implementation
- Fixed TypeScript type generation using json-schema-to-typescript-lite for tool input schemas
- Fixed async function signature by making `createInterpreterTool` return a Promise

## 2025-08-10 12:00

- Added `onExecute` callback to `createRenderFormTool` configuration
- Added validation for `updateHolocronJsonc` tool to ensure holocron.jsonc file is read before calling
- Wrapped render form tool execution in try-catch to properly return errors

## 2025-08-04 17:49

- Fixed TypeScript errors in process-chat tests by using correct UIMessageChunk types
- Updated error propagation tests to handle AI SDK's error handling behavior correctly
- Replaced invalid chunk type '0' with proper 'text-delta' chunk type

## 2025-08-02 15:30

- Added `onError` parameter to `asyncIterableToReadableStream` function to enable error callbacks
- Updated `uiStreamToUIMessages` to capture errors via closure variable and throw inside the loop when error is captured