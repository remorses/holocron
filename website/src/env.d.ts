declare module '*.md?raw' {
  const content: string
  export default content
}

declare module 'virtual:importmap' {
  const importMap: {
    imports: Record<string, string>
  }
  export default importMap
}
