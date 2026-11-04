import type { PartMesh, Vec3 } from './types';

/**
 * Reads a binary or ASCII STL into an indexed mesh. Corners at the same point are merged, and
 * normals are smoothed across shallow edges but stay sharp where faces meet at more than the
 * crease angle, so a plate keeps crisp edges and bone stays smooth. Units are taken as millimetres.
 */
export function readStl(bytes: Uint8Array, creaseDeg = 40): PartMesh {
  const { points, corners } = weld(triangleSoup(bytes));
  if (!corners.length) throw new Error('This STL file has no triangles.');
  return shade(points, corners, Math.cos((creaseDeg * Math.PI) / 180));
}

/** Nine numbers per triangle: its three corners. */
export function triangleSoup(bytes: Uint8Array): Float32Array {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  // Some binary files start with "solid" too, so the size test comes first.
  if (bytes.length >= 84) {
    const n = view.getUint32(80, true);
    if (84 + n * 50 === bytes.length) {
      const out = new Float32Array(n * 9);
      for (let t = 0; t < n; t++) {
        const at = 84 + t * 50 + 12;
        for (let k = 0; k < 9; k++) out[t * 9 + k] = view.getFloat32(at + k * 4, true);
      }
      return out;
    }
  }
  const text = new TextDecoder().decode(bytes);
  if (!/^\s*solid/i.test(text) || !/facet/i.test(text)) throw new Error('This is not an STL file.');
  const values: number[] = [];
  for (const m of text.matchAll(/vertex\s+(\S+)\s+(\S+)\s+(\S+)/gi)) values.push(+m[1], +m[2], +m[3]);
  if (!values.length || values.length % 9 || values.some((v) => !Number.isFinite(v))) throw new Error('This STL file is damaged.');
  return Float32Array.from(values);
}

/** Merges corners that sit on exactly the same point, and drops triangles with no area. */
export function weld(soup: Float32Array): { points: Float32Array; corners: Uint32Array } {
  const n = soup.length / 3;
  const bits = new Uint32Array(soup.buffer, soup.byteOffset, soup.length);
  const key = (k: number) => (soup[k] === 0 ? 0 : bits[k]); // -0 and 0 are the same point
  let size = 1;
  while (size < n * 2) size <<= 1;
  const mask = size - 1, table = new Int32Array(size).fill(-1);
  const points = new Float32Array(n * 3);
  let count = 0;
  const ids = new Uint32Array(n);
  for (let v = 0; v < n; v++) {
    const a = key(v * 3), b = key(v * 3 + 1), c = key(v * 3 + 2);
    let h = (Math.imul(a, 73856093) ^ Math.imul(b, 19349663) ^ Math.imul(c, 83492791)) & mask;
    for (;;) {
      const at = table[h];
      if (at < 0) {
        table[h] = count;
        points.set(soup.subarray(v * 3, v * 3 + 3), count * 3);
        ids[v] = count++;
        break;
      }
      if (points[at * 3] === soup[v * 3] && points[at * 3 + 1] === soup[v * 3 + 1] && points[at * 3 + 2] === soup[v * 3 + 2]) { ids[v] = at; break; }
      h = (h + 1) & mask;
    }
  }
  const kept: number[] = [];
  for (let t = 0; t < n / 3; t++) {
    const i = ids[t * 3], j = ids[t * 3 + 1], k = ids[t * 3 + 2];
    if (i === j || j === k || i === k) continue;
    const ax = points[j * 3] - points[i * 3], ay = points[j * 3 + 1] - points[i * 3 + 1], az = points[j * 3 + 2] - points[i * 3 + 2];
    const bx = points[k * 3] - points[i * 3], by = points[k * 3 + 1] - points[i * 3 + 1], bz = points[k * 3 + 2] - points[i * 3 + 2];
    if (ay * bz - az * by === 0 && az * bx - ax * bz === 0 && ax * by - ay * bx === 0) continue;
    kept.push(i, j, k);
  }
  return { points: points.slice(0, count * 3), corners: Uint32Array.from(kept) };
}

function shade(points: Float32Array, corners: Uint32Array, cosCrease: number): PartMesh {
  const faces = corners.length / 3, nPoints = points.length / 3;
  // Face normals: weighted by area for averaging, and unit length for the crease test.
  const weighted = new Float32Array(faces * 3), unit = new Float32Array(faces * 3);
  for (let f = 0; f < faces; f++) {
    const i = corners[f * 3] * 3, j = corners[f * 3 + 1] * 3, k = corners[f * 3 + 2] * 3;
    const ax = points[j] - points[i], ay = points[j + 1] - points[i + 1], az = points[j + 2] - points[i + 2];
    const bx = points[k] - points[i], by = points[k + 1] - points[i + 1], bz = points[k + 2] - points[i + 2];
    const nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx, len = Math.hypot(nx, ny, nz) || 1;
    weighted.set([nx, ny, nz], f * 3);
    unit.set([nx / len, ny / len, nz / len], f * 3);
  }
  // The faces around each point.
  const start = new Uint32Array(nPoints + 1);
  for (const c of corners) start[c + 1]++;
  for (let p = 0; p < nPoints; p++) start[p + 1] += start[p];
  const around = new Uint32Array(corners.length), fill = start.slice(0, nPoints);
  for (let c = 0; c < corners.length; c++) around[fill[corners[c]]++] = (c / 3) | 0;

  const positions = new Float32Array(corners.length * 3), normals = new Float32Array(corners.length * 3);
  const indices = new Uint32Array(corners.length);
  let out = 0;
  const n = [0, 0, 0];
  for (let p = 0; p < nPoints; p++) {
    const first = out;
    for (let a = start[p]; a < start[p + 1]; a++) {
      const f = around[a];
      n[0] = n[1] = n[2] = 0;
      for (let b = start[p]; b < start[p + 1]; b++) {
        const g = around[b];
        if (unit[f * 3] * unit[g * 3] + unit[f * 3 + 1] * unit[g * 3 + 1] + unit[f * 3 + 2] * unit[g * 3 + 2] < cosCrease) continue;
        n[0] += weighted[g * 3]; n[1] += weighted[g * 3 + 1]; n[2] += weighted[g * 3 + 2];
      }
      const len = Math.hypot(n[0], n[1], n[2]) || 1;
      n[0] /= len; n[1] /= len; n[2] /= len;
      // Reuse a vertex at this point that already has the same normal.
      let id = -1;
      for (let o = first; o < out; o++) {
        if (normals[o * 3] * n[0] + normals[o * 3 + 1] * n[1] + normals[o * 3 + 2] * n[2] > 0.9999) { id = o; break; }
      }
      if (id < 0) {
        id = out++;
        positions.set(points.subarray(p * 3, p * 3 + 3), id * 3);
        normals.set(n, id * 3);
      }
      const c = corners[f * 3] === p ? 0 : corners[f * 3 + 1] === p ? 1 : 2;
      indices[f * 3 + c] = id;
    }
  }
  const bboxMin: Vec3 = [Infinity, Infinity, Infinity], bboxMax: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (let p = 0; p < nPoints; p++) {
    for (let d = 0; d < 3; d++) {
      const v = points[p * 3 + d];
      if (v < bboxMin[d]) bboxMin[d] = v;
      if (v > bboxMax[d]) bboxMax[d] = v;
    }
  }
  return { positions: positions.slice(0, out * 3), normals: normals.slice(0, out * 3), indices, bboxMin, bboxMax, triangles: faces };
}
