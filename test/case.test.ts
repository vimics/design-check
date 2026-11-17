import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parsePartName, readCaseFolder, readCasesFolder } from '../plugins/case';
import { readStl } from '../src/engine/stl';
import { binaryStl, box } from './shapes';

describe('part names', () => {
  it('takes the label and tag from the file name', () => {
    expect(parsePartName('TPLO plate 3.5 mm.metal.stl')).toEqual({ label: 'TPLO plate 3.5 mm', tag: 'metal' });
    expect(parsePartName('Cutting_guide.Resin-Clear.STL')).toEqual({ label: 'Cutting guide', tag: 'resin-clear' });
    expect(parsePartName('Osteosarcoma.Tumor.stl')).toEqual({ label: 'Osteosarcoma', tag: 'tumor' });
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
    const { folder: f } = readCaseFolder(folder({ 'case.json': '{ "dvm": "A B", "patient": "C" }', 'A screw.screw.stl': stl, 'Plate.metal.stl': stl, 'Mass.tumor.stl': stl, 'Tibia.bone.stl': stl }));
    expect(f.parts.map((p) => p.label)).toEqual(['Tibia', 'Mass', 'Plate', 'A screw']);
  });

});

describe('cases folder', () => {
  const stl = binaryStl(box([0, 0, 0], [1, 1, 1]));
  /** Builds a cases folder: each key is a case folder (or a loose file), each value its files. */
  const root = (cases: Record<string, Record<string, string | Uint8Array> | string>) => {
    const dir = mkdtempSync(join(tmpdir(), 'cases-'));
    for (const [name, files] of Object.entries(cases)) {
      if (typeof files === 'string') { writeFileSync(join(dir, name), files); continue; }
      mkdirSync(join(dir, name));
      for (const [file, body] of Object.entries(files)) writeFileSync(join(dir, name, file), body);
    }
    return dir;
  };

  it('reads each case folder', () => {
    const { cases, problems } = readCasesFolder(root({
      karamel: { 'case.json': '{ "dvm": "A B", "patient": "Karamel" }', 'Tibia.bone.stl': stl },
      max: { 'case.json': '{ "dvm": "C D", "patient": "Max" }', 'Mass.tumor.stl': stl },
      'README.md': 'x',
      '.DS_Store': 'x',
    }));
    expect(problems).toEqual([]);
    expect(cases.map((c) => [c.name, c.patient])).toEqual([['karamel', 'Karamel'], ['max', 'Max']]);
  });

  it('names the case folder in each problem', () => {
    const { problems } = readCasesFolder(root({
      karamel: { 'case.json': '{ "dvm": "A B", "patient": "Karamel" }', 'Tibia.stl': stl },
      empty: {},
    }));
    expect(problems.join('\n')).toContain('karamel: "Tibia.stl" needs a tag');
    expect(problems.join('\n')).toMatch(/empty: .*case\.json is missing/);
  });

  it('explains a loose file outside the case folders', () => {
    const { problems } = readCasesFolder(root({ 'Tibia.bone.stl': 'x' }));
    expect(problems.join('\n')).toContain('"Tibia.bone.stl" is loose');
  });

  it('refuses two cases with the same names, however they are typed', () => {
    const { problems } = readCasesFolder(root({
      a: { 'case.json': '{ "dvm": "Ayşe Yılmaz", "patient": "Max" }', 'T.bone.stl': stl },
      b: { 'case.json': '{ "dvm": "Dr. ayse yilmaz", "patient": "MAX" }', 'T.bone.stl': stl },
    }));
    expect(problems.join('\n')).toContain('b and a have the same DVM and patient names');
  });

  it('needs at least one case', () => {
    expect(readCasesFolder(root({})).problems[0]).toContain('has no cases');
  });

  // The deploy runs this first, so a mistake in a live case stops it before anything is published.
  for (const dir of ['cases', 'e2e/fixture-cases']) {
    it(`${dir} is ready to publish`, () => {
      const { cases, problems } = readCasesFolder(dir);
      expect(problems).toEqual([]);
      expect(cases.length).toBeGreaterThan(0);
      for (const c of cases) for (const p of c.parts) {
        const mesh = readStl(new Uint8Array(readFileSync(join(dir, c.name, p.file))));
        expect(mesh.triangles, `${c.name}/${p.file} has no triangles`).toBeGreaterThan(0);
      }
    });
  }
});
