import { readStl } from './stl';
import type { CaseManifest } from './types';

export type LoadRequest = { parts: CaseManifest['parts'] };

const scope = self as unknown as DedicatedWorkerGlobalScope;

/** Downloads each part, unzips and reads it here, so the page stays responsive. */
scope.onmessage = async (e: MessageEvent<LoadRequest>) => {
  const { parts } = e.data;
  const total = parts.reduce((n, p) => n + p.bytes, 0);
  let loaded = 0;
  try {
    for (let i = 0; i < parts.length; i++) {
      const r = await fetch(parts[i].url);
      if (!r.ok || !r.body) throw new Error(`${parts[i].label} could not be downloaded (${r.status}).`);
      const chunks: Uint8Array[] = [];
      const reader = r.body.getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        loaded += value.length;
        scope.postMessage({ type: 'progress', share: Math.min(1, loaded / total) });
      }
      let bytes = new Uint8Array(await new Blob(chunks as BlobPart[]).arrayBuffer());
      // A server may already have unzipped it on the way, so check before unzipping.
      if (bytes[0] === 0x1f && bytes[1] === 0x8b) {
        bytes = new Uint8Array(await new Response(new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
      }
      const mesh = readStl(bytes);
      scope.postMessage({ type: 'part', index: i, mesh }, [mesh.positions.buffer, mesh.normals.buffer, mesh.indices.buffer]);
    }
    scope.postMessage({ type: 'done' });
  } catch (err) {
    scope.postMessage({ type: 'error', message: err instanceof Error ? err.message : String(err) });
  }
};
