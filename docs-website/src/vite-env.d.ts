/// <reference types="vite/client" />

declare module 'virtual:importmap' {
  const importMap: {
    imports: Record<string, string>
  }
  export default importMap
}
