/** Simple closed shapes as binary STL, in millimetres, for tests and the fixture case. */

type V = [number, number, number];

export function binaryStl(triangles: V[][]): Uint8Array {
  const out = new Uint8Array(84 + triangles.length * 50), view = new DataView(out.buffer);
  view.setUint32(80, triangles.length, true);
  triangles.forEach((t, i) => t.forEach((p, c) => p.forEach((v, d) => view.setFloat32(84 + i * 50 + 12 + c * 12 + d * 4, v, true))));
  return out;
}

export function asciiStl(triangles: V[][]): string {
  const facets = triangles.map((t) => `facet normal 0 0 0\n outer loop\n${t.map((p) => `  vertex ${p.join(' ')}`).join('\n')}\n endloop\nendfacet`);
  return `solid shape\n${facets.join('\n')}\nendsolid shape\n`;
}

/** Twelve triangles, wound outward. */
export function box(min: V, max: V): V[][] {
  const p = (i: number): V => [i & 1 ? max[0] : min[0], i & 2 ? max[1] : min[1], i & 4 ? max[2] : min[2]];
  const quads = [[0, 2, 3, 1], [4, 5, 7, 6], [0, 1, 5, 4], [2, 6, 7, 3], [0, 4, 6, 2], [1, 3, 7, 5]];
  return quads.flatMap(([a, b, c, d]) => [[p(a), p(b), p(c)], [p(a), p(c), p(d)]]);
}

/** A closed cylinder along one axis (0 = X, 1 = Y, 2 = Z), from `from` to `to` on that axis. */
export function cylinder(axis: 0 | 1 | 2, center: [number, number], radius: number, from: number, to: number, segments = 48): V[][] {
  const at = (angle: number, h: number): V => {
    const u = center[0] + radius * Math.cos(angle), v = center[1] + radius * Math.sin(angle);
    return axis === 0 ? [h, u, v] : axis === 1 ? [v, h, u] : [u, v, h];
  };
  const axisPoint = (h: number): V => (axis === 0 ? [h, center[0], center[1]] : axis === 1 ? [center[1], h, center[0]] : [center[0], center[1], h]);
  const tris: V[][] = [];
  for (let s = 0; s < segments; s++) {
    // The last segment ends on the first point exactly, so the shape closes.
    const a = (s / segments) * Math.PI * 2, b = (((s + 1) % segments) / segments) * Math.PI * 2;
    tris.push([at(a, from), at(b, from), at(b, to)], [at(a, from), at(b, to), at(a, to)]);
    tris.push([axisPoint(from), at(b, from), at(a, from)], [axisPoint(to), at(a, to), at(b, to)]);
  }
  return tris;
}

/** Five parts, one per tag, laid out like a plate and screw on a bone. */
export const FIXTURE: Record<string, V[][]> = {
  'Tibia.bone.stl': cylinder(2, [0, 0], 8, -40, 40),
  'TPLO plate 3.5 mm.metal.stl': box([8.5, -5, -20], [11.5, 5, 20]),
  'Screw 1.screw.stl': cylinder(0, [0, 10], 1.75, -6, 13),
  'Cutting guide.resin-clear.stl': box([8.5, -8, 22], [14, 8, 30]),
  'Spacer.resin-white.stl': box([-12, -3, -30], [-8.5, 3, -25]),
};
