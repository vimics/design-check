import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import type { Plugin } from 'vite';
import { TAGS, type CaseManifest, type Tag } from '../src/engine/types';

export interface CaseFolder {
  dvm: string;
  patient: string;
  note: string;
  parts: Array<{ file: string; label: string; tag: Tag }>;
}

const FIELDS = ['dvm', 'patient', 'note'];
const IGNORED = /^(\..*|readme\.md)$/i;

/** `Tibia.bone.stl` gives the label "Tibia" and the tag bone. Underscores read as spaces. */
export function parsePartName(file: string): { label: string; tag: Tag } | string {
  const m = /^(.*)\.([^.]+)\.stl$/i.exec(file);
  if (!m) return `"${file}" needs a tag before .stl, like "Tibia.bone.stl". Tags: ${TAGS.join(', ')}.`;
  const label = m[1].replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
  const tag = m[2].toLowerCase().replace(/[\s_]+/g, '-');
  if (!(TAGS as readonly string[]).includes(tag)) return `"${file}" has the tag "${m[2]}". Use one of: ${TAGS.join(', ')}.`;
  if (!label) return `"${file}" needs a name before the tag, like "Tibia.bone.stl".`;
  return { label, tag: tag as Tag };
}

/** Reads and checks the case folder. Every problem is listed in plain words, naming the file. */
export function readCaseFolder(dir: string): { folder: CaseFolder; problems: string[] } {
  const problems: string[] = [];
  const folder: CaseFolder = { dvm: '', patient: '', note: '', parts: [] };
  let names: string[] = [];
  try { names = readdirSync(dir).sort((a, b) => a.localeCompare(b)); } catch { problems.push(`The folder ${dir} is missing.`); }

  if (!names.includes('case.json')) problems.push(`${dir}/case.json is missing.`);
  else {
    try {
      const data = JSON.parse(readFileSync(join(dir, 'case.json'), 'utf8')) as Record<string, unknown>;
      for (const k of Object.keys(data)) if (!FIELDS.includes(k)) problems.push(`case.json has "${k}", which isn't used. The fields are dvm, patient and note.`);
      for (const k of FIELDS) {
        const v = data[k] ?? '';
        if (typeof v !== 'string') problems.push(`case.json: "${k}" must be text in quotes.`);
        else folder[k as 'dvm' | 'patient' | 'note'] = v.trim();
      }
      if (!folder.dvm) problems.push('case.json: "dvm" is empty. Write the DVM\'s first and last name.');
      if (!folder.patient) problems.push('case.json: "patient" is empty. Write the patient\'s name.');
    } catch (e) {
      problems.push(`case.json can't be read: ${(e as Error).message}. Check for a missing comma or quote.`);
    }
  }

  for (const file of names) {
    if (file === 'case.json' || IGNORED.test(file)) continue;
    const parsed = parsePartName(file);
    if (typeof parsed === 'string') problems.push(/\.stl$/i.test(file) ? parsed : `"${file}" isn't an STL file. Only STL files and case.json belong in the case folder.`);
    else folder.parts.push({ file, ...parsed });
  }
  // Bone first, then the parts made for it, so the list reads the same way every case.
  folder.parts.sort((a, b) => TAGS.indexOf(a.tag) - TAGS.indexOf(b.tag) || a.label.localeCompare(b.label));
  if (!folder.parts.length && names.length) problems.push('The case folder has no STL files.');
  return { folder, problems };
}

const VIRTUAL = 'virtual:case', RESOLVED = '\0virtual:case';

/** Hands the case to the page and publishes each STL gzipped, under a name that changes with its content. */
export function casePlugin(dir: string): Plugin {
  let manifest: CaseManifest;
  const files = new Map<string, Buffer>();

  const load = () => {
    const { folder, problems } = readCaseFolder(dir);
    if (problems.length) throw new Error(`The case folder has problems:\n- ${problems.join('\n- ')}`);
    files.clear();
    const parts = folder.parts.map((p) => {
      const gz = gzipSync(readFileSync(join(dir, p.file)), { level: 9 });
      const url = `case/${createHash('sha256').update(gz).digest('hex').slice(0, 12)}.stl.gz`;
      files.set(url, gz);
      return { url, label: p.label, tag: p.tag, bytes: gz.length };
    });
    const id = createHash('sha256').update(JSON.stringify([folder.dvm, folder.patient, parts.map((p) => p.url)])).digest('hex').slice(0, 12);
    manifest = { id, dvm: folder.dvm, patient: folder.patient, note: folder.note, parts };
  };

  return {
    name: 'case',
    buildStart() { load(); },
    resolveId(id) { return id === VIRTUAL ? RESOLVED : null; },
    load(id) { return id === RESOLVED ? `export default ${JSON.stringify(manifest)};` : null; },
    generateBundle() {
      for (const [fileName, source] of files) this.emitFile({ type: 'asset', fileName, source });
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const body = files.get((req.url ?? '').replace(/^\//, '').split('?')[0]);
        if (!body) return next();
        res.setHeader('Content-Type', 'application/gzip');
        res.end(body);
      });
    },
  };
}
