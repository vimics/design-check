/// <reference types="vite/client" />

/** The live cases, written by plugins/case.ts. Typed as CaseManifest[] where it is imported. */
declare module 'virtual:case' {
  const manifest: unknown;
  export default manifest;
}
