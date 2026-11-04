import { describe, expect, it } from 'vitest';
import { readStl, triangleSoup, weld } from '../src/engine/stl';
import { asciiStl, binaryStl, box, cylinder } from './shapes';

/** Volume by the divergence theorem, which only comes out right for a closed, outward-facing mesh. */
function volume(m: { positions: Float32Array; indices: Uint32Array }): number {
  let v = 0;
  const p = (i: number) => [m.positions[i * 3], m.positions[i * 3 + 1], m.positions[i * 3 + 2]];
  for (let t = 0; t < m.indices.length; t += 3) {
    const [a, b, c] = [p(m.indices[t]), p(m.indices[t + 1]), p(m.indices[t + 2])];
    v += a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0]);
  }
  return v / 6;
}

/** Every edge of a closed mesh is shared by exactly two triangles. */
function closed(corners: Uint32Array): boolean {
  const edges = new Map<string, number>();
  for (let t = 0; t < corners.length; t += 3) {
    for (let e = 0; e < 3; e++) {
      const a = corners[t + e], b = corners[t + ((e + 1) % 3)];
      const k = a < b ? `${a},${b}` : `${b},${a}`;
      edges.set(k, (edges.get(k) ?? 0) + 1);
    }
  }
  return [...edges.values()].every((n) => n === 2);
}

const cube = box([0, 0, 0], [10, 20, 30]);

describe('reading STL', () => {
  it('reads binary and ASCII to the same triangles', () => {
    const fromBinary = triangleSoup(binaryStl(cube));
    const fromAscii = triangleSoup(new TextEncoder().encode(asciiStl(cube)));
    expect(fromBinary.length).toBe(12 * 9);
    expect([...fromAscii]).toEqual([...fromBinary]);
  });

  it('reads a binary file whose header starts with "solid"', () => {
    const bytes = binaryStl(cube);
    bytes.set(new TextEncoder().encode('solid exported by CAD'), 0);
    expect(triangleSoup(bytes).length).toBe(12 * 9);
  });

  it('keeps true millimetres: volume and bounds of a known box', () => {
    const m = readStl(binaryStl(cube));
    expect(volume(m)).toBeCloseTo(10 * 20 * 30, 3);
    expect(m.bboxMin).toEqual([0, 0, 0]);
    expect(m.bboxMax).toEqual([10, 20, 30]);
    expect(m.triangles).toBe(12);
  });

  it('merges corners into a closed mesh', () => {
    const { points, corners } = weld(triangleSoup(binaryStl(cylinder(2, [0, 0], 5, 0, 10))));
    expect(points.length / 3).toBe(48 * 2 + 2);
    expect(closed(corners)).toBe(true);
  });

  it('keeps a box sharp and a cylinder side smooth', () => {
    // A cube corner has three faces at 90°, so three normals each: 24 vertices.
    expect(readStl(binaryStl(cube)).positions.length / 3).toBe(24);
    // The side shares one normal per rim point; each cap adds its own flat ones.
    const c = readStl(binaryStl(cylinder(2, [0, 0], 5, 0, 10)));
    expect(c.positions.length / 3).toBe(48 * 2 + 48 * 2 + 2);
    expect(volume(c)).toBeCloseTo(Math.PI * 25 * 10, -1);
  });

  it('drops triangles with no area', () => {
    const flat: [number, number, number][][] = [[[0, 0, 0], [1, 1, 1], [2, 2, 2]], [[0, 0, 0], [0, 0, 0], [1, 0, 0]]];
    expect(weld(triangleSoup(binaryStl([...cube, ...flat]))).corners.length).toBe(12 * 3);
  });

  it('refuses files that are not STL', () => {
    expect(() => readStl(new TextEncoder().encode('hello'))).toThrow('not an STL');
    expect(() => readStl(new TextEncoder().encode('solid x\nfacet\nvertex 1 2\n'))).toThrow('damaged');
  });
});
