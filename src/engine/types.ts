export type Vec3 = [number, number, number];

/** What each STL is made of. The file name carries it: `<label>.<tag>.stl`. */
export const TAGS = ['bone', 'tumor', 'metal', 'resin-white', 'resin-clear', 'screw'] as const;
export type Tag = (typeof TAGS)[number];

export interface PartMesh {
  positions: Float32Array;
  normals: Float32Array;
  indices: Uint32Array;
  bboxMin: Vec3;
  bboxMax: Vec3;
  triangles: number;
}

export interface Part extends PartMesh {
  label: string;
  tag: Tag;
}

/** One case, as the build hands it to the page. The page gets a list of them, one per folder in cases/. */
export interface CaseManifest {
  dvm: string;
  patient: string;
  note: string;
  parts: Array<{ url: string; label: string; tag: Tag; bytes: number }>;
}
