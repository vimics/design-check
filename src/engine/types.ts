export type Vec3 = [number, number, number];

/** What each STL is made of. The file name carries it: `<label>.<tag>.stl`. */
export const TAGS = ['bone', 'metal', 'resin-white', 'resin-clear', 'screw'] as const;
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

/** The current case, as the build hands it to the page. */
export interface CaseManifest {
  /** Changes whenever the case does, so an earlier match doesn't open a new case. */
  id: string;
  dvm: string;
  patient: string;
  note: string;
  parts: Array<{ url: string; label: string; tag: Tag; bytes: number }>;
}
