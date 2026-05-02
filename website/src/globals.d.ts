// CSS import declarations and worker type references for the website app.

/// <reference path="../worker-configuration.d.ts" />

declare module '*.css' {
  const content: string
  export default content
}

declare module 'jpeg-js' {
  interface DecodedJPEG {
    width: number
    height: number
    data: Uint8Array
  }
  function decode(data: Uint8Array | Buffer, opts?: { formatAsRGBA?: boolean; useTArray?: boolean; maxMemoryUsageInMB?: number }): DecodedJPEG
  function encode(imgData: { data: Uint8Array | Buffer; width: number; height: number }, quality: number): { data: Uint8Array; width: number; height: number }
  export { decode, encode }
}
