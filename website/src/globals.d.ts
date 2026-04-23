// CSS import declarations and worker type references for the website app.

/// <reference path="../worker-configuration.d.ts" />

declare module '*.css' {
  const content: string
  export default content
}
