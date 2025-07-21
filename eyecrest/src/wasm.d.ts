declare module "*.wasm" {
  const content: WebAssembly.Module;
  export default content;
}

declare module "*.wasm?url" {
  const content: string;
  export default content;
}