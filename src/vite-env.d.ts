/// <reference types="vite/client" />

declare module "*.txt?raw" {
  const source: string;
  export default source;
}
