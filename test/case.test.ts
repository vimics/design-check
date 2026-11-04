import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parsePartName, readCaseFolder } from '../plugins/case';
import { readStl } from '../src/engine/stl';
import { binaryStl, box } from './shapes';

describe('part names', () => {
  it('takes the label and tag from the file name', () => {
    expect(parsePartName('TPLO plate 3.5 mm.metal.stl')).toEqual({ label: 'TPLO plate 3.5 mm', tag: 'metal' });
    expect(parsePartName('Cutting_guide.Resin-Clear.STL')).toEqual({ label: 'Cutting guide', tag: 'resin-clear' });
    expect(parsePartName('Spacer.resin white.stl')).toEqual({ label: 'Spacer', tag: 'resin-white' });
  });

  it('explains a missing or unknown tag', () => {
    expect(parsePartName('Tibia.stl')).toContain('needs a tag');
    expect(parsePartName('Tibia.titanium.stl')).toContain('"titanium"');
  });
});

describe('case folder', () => {
  const folder = (files: Record<string, string | Uint8Array>) => {
    const dir = mkdtempSync(join(tmpdir(), 'case-'));
    for (const [name, body] of Object.entries(files)) writeFileSync(join(dir, name), body);
    return dir;
  };
  const stl = binaryStl(box([0, 0, 0], [1, 1, 1]));

  it('lists every problem, naming the file', () => {
    const { problems } = readCaseFolder(folder({ 'case.json': '{ "dvm": "A B", "patient": "", "Note": "x" }', 'Tibia.stl': stl, 'scan.zip': 'x' }));
    expect(problems.join('\n')).toContain('"patient" is empty');
    expect(problems.join('\n')).toContain('"Note"');
    expect(problems.join('\n')).toContain('"Tibia.stl" needs a tag');
    expect(problems.join('\n')).toContain('"scan.zip" isn\'t an STL');
  });

  it('explains broken JSON', () => {
    expect(readCaseFolder(folder({ 'case.json': '{ "dvm": "A" "patient": "B" }', 'a.bone.stl': stl })).problems[0]).toContain('missing comma');
  });

  it('accepts a good folder', () => {
    const { folder: f, problems } = readCaseFolder(folder({ 'case.json': '{ "dvm": "A B", "patient": "C" }', 'a.bone.stl': stl, '.DS_Store': 'x' }));
    expect(problems).toEqual([]);
    expect(f).toEqual({ dvm: 'A B', patient: 'C', note: '', parts: [{ file: 'a.bone.stl', label: 'a', tag: 'bone' }] });
  });

  it('lists bone first, then the other parts by tag', () => {
    const { folder: f } = readCaseFolder(folder({ 'case.json': '{ "dvm": "A B", "patient": "C" }', 'A screw.screw.stl': stl, 'Plate.metal.stl': stl, 'Tibia.bone.stl': stl }));
    expect(f.parts.map((p) => p.label)).toEqual(['Tibia', 'Plate', 'A screw']);
  });

  // The deploy runs this first, so a mistake in the live case stops it before anything is published.
  for (const dir of ['case', 'e2e/fixture-case']) {
    it(`${dir} is ready to publish`, () => {
      const { folder: f, problems } = readCaseFolder(dir);
      expect(problems).toEqual([]);
      for (const p of f.parts) {
        const mesh = readStl(new Uint8Array(readFileSync(join(dir, p.file))));
        expect(mesh.triangles, `${p.file} has no triangles`).toBeGreaterThan(0);
      }
    });
  }
});
