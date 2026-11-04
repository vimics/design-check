import caseData from 'virtual:case';
import type { CaseManifest, Part, PartMesh } from '../engine/types';
import { LOOKS, Viewer, type MeasureKind, type Measurement } from '../engine/viewer/viewer';
import { matches } from './check';

const manifest = caseData as CaseManifest;
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const num = (n: number) => n.toLocaleString('en-GB');
const LOGO = document.querySelector('.logo-link svg')?.outerHTML ?? '';
/** Holds the case a DVM opened in this tab, so a refresh doesn't ask again but a new case does. */
const OPENED = 'design-viewer-case';

const caseLine = `${manifest.patient} · Prepared for ${manifest.dvm}, DVM`;
const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

// ---- Screens ----------------------------------------------------------------------------------

type Screen = 'gate' | 'loading' | 'viewer' | 'error';

function show(screen: Screen) {
  const inWorkspace = screen !== 'gate';
  $('giris').hidden = inWorkspace;
  $('calisma').hidden = !inWorkspace;
  $('perde-yukle').hidden = screen !== 'loading';
  $('perde-hata').hidden = screen !== 'error';
  document.querySelector('.ray')?.toggleAttribute('hidden', screen !== 'viewer');
  $('calisma').style.gridTemplateColumns = screen === 'viewer' ? '' : 'minmax(0, 1fr)';
  $('vaka').hidden = !inWorkspace;
  $('yanit').hidden = !inWorkspace;
}

// ---- Name check -------------------------------------------------------------------------------

$<HTMLFormElement>('form').addEventListener('submit', (e) => {
  e.preventDefault();
  const typed = { dvm: $<HTMLInputElement>('f-dvm').value, patient: $<HTMLInputElement>('f-patient').value };
  const error = $('giris-hata');
  if (!matches(typed, manifest)) {
    error.textContent = "These names don't match with a case. Check the spelling, or write to info@vimics.vet.";
    error.hidden = false;
    $('form').classList.add('hatali');
    $('f-dvm').focus();
    return;
  }
  sessionStorage.setItem(OPENED, manifest.id);
  openCase();
});
for (const id of ['f-dvm', 'f-patient']) {
  $(id).addEventListener('input', () => { $('giris-hata').hidden = true; $('form').classList.remove('hatali'); });
}

// ---- Loading ----------------------------------------------------------------------------------

let viewer: Viewer | null = null;
let parts: Part[] = [];
let visible: boolean[] = [];
let seeThrough: boolean[] = [];

function openCase() {
  show('loading');
  $('vaka-satir').textContent = caseLine;
  $('vaka-satir').title = caseLine;
  $<HTMLAnchorElement>('yanit').href = `mailto:info@vimics.vet?subject=${encodeURIComponent(`Design – ${manifest.patient}`)}`;
  $('not').hidden = !manifest.note;
  $('not-metin').textContent = manifest.note;
  $('yukle-cubuk').style.width = '2%';

  const worker = new Worker(new URL('../engine/load.worker.ts', import.meta.url), { type: 'module' });
  const meshes: PartMesh[] = [];
  const fail = (message: string) => {
    worker.terminate();
    $('hata-metin').textContent = message;
    show('error');
  };
  worker.onmessage = (e) => {
    const m = e.data;
    if (m.type === 'progress') $('yukle-cubuk').style.width = `${Math.max(2, m.share * 90)}%`;
    else if (m.type === 'part') meshes[m.index] = m.mesh;
    else if (m.type === 'error') fail(m.message);
    else if (m.type === 'done') {
      worker.terminate();
      parts = manifest.parts.map((p, i) => ({ ...meshes[i], label: p.label, tag: p.tag }));
      visible = parts.map(() => true);
      seeThrough = parts.map(() => false);
      show('viewer');
      const v = ensureViewer();
      v.setParts(parts);
      // Mimics exports keep the scanner's frame, the same one V-Seg uses for a DICOM series.
      v.setScanFrame([1, 0, 0], [0, 1, 0]);
      v.fit(false);
      setupClipRanges();
      renderStructures();
      renderSummary();
    }
  };
  worker.onerror = (e) => fail(e.message || 'A background worker failed to start.');
  // The worker resolves addresses from its own script, so they are made absolute here.
  worker.postMessage({ parts: manifest.parts.map((p) => ({ ...p, url: new URL(p.url, document.baseURI).href })) });
}
$('yeniden').addEventListener('click', openCase);

// ---- Viewer -----------------------------------------------------------------------------------

function ensureViewer(): Viewer {
  if (viewer) return viewer;
  viewer = new Viewer({
    host: $('sahne'),
    canvas: $<HTMLCanvasElement>('tuval'),
    overlay: $('katman') as unknown as SVGSVGElement,
    labels: $('etiketler'),
    cube: $('kup'),
    scaleText: $('olcek-yazi'),
    scaleBar: $('olcek-cizgi'),
  }, {
    onMeasurementsChanged: renderMeasurements,
    onToolChanged: renderTool,
    onStructureClicked: showStructureAction,
    onFaceOnChanged: (on) => { document.querySelectorAll<HTMLElement>('[data-cevir]').forEach((b) => { b.hidden = !on; }); },
    onCameraMoved: () => { $('aksiyon').hidden = true; },
  });
  return viewer;
}

const hex = (color: number) => `#${color.toString(16).padStart(6, '0')}`;

function renderStructures() {
  const ul = $('parcalar');
  ul.replaceChildren();
  parts.forEach((p, i) => {
    const look = LOOKS[p.tag];
    const li = document.createElement('li');
    li.className = visible[i] ? '' : 'kapali';
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.checked = visible[i];
    box.setAttribute('aria-label', `Show ${p.label}`);
    box.addEventListener('change', () => setVisible(i, box.checked));
    const swatch = document.createElement('span');
    swatch.className = `renk${look.opacity < 1 ? ' saydam' : ''}`;
    swatch.style.setProperty('--renk', hex(look.color));
    const name = document.createElement('span');
    name.className = 'ad';
    const label = document.createElement('b');
    label.textContent = p.label;
    const kind = document.createElement('small');
    kind.textContent = look.name;
    name.append(label, kind);
    const through = document.createElement('button');
    through.type = 'button';
    through.className = 'gecirgen';
    through.title = 'See through';
    through.setAttribute('aria-label', `See through ${p.label}`);
    through.setAttribute('aria-pressed', String(seeThrough[i]));
    through.disabled = !visible[i];
    through.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="6" cy="8" r="4.5"/><circle cx="10" cy="8" r="4.5"/></svg>';
    through.addEventListener('click', () => {
      seeThrough[i] = !seeThrough[i];
      viewer?.setSeeThrough(i, seeThrough[i]);
      renderStructures();
    });
    li.append(box, swatch, name, through);
    li.addEventListener('mouseenter', () => viewer?.highlightStructure(i, true));
    li.addEventListener('mouseleave', () => viewer?.highlightStructure(i, false));
    ul.append(li);
  });
}

function setVisible(i: number, on: boolean) {
  visible[i] = on;
  viewer?.setStructureVisible(i, on);
  renderStructures();
  renderSummary();
  renderHint();
}

function renderSummary() {
  const shown = parts.filter((_, i) => visible[i]);
  const triangles = shown.reduce((n, p) => n + p.triangles, 0);
  $('ozet').innerHTML = `<b>${shown.length}</b> of ${parts.length} parts · <b>${num(triangles)}</b> triangles`;
}

/** Says why the view is empty, unless a measuring tool is using the same spot for its instructions. */
function renderHint() {
  if (viewer?.tool) return;
  const hint = $('ipucu');
  hint.hidden = visible.some(Boolean);
  hint.textContent = 'Every part is hidden. Tick one under Structures.';
}

let selectedStructure: number | null = null;
function showStructureAction(index: number | null, x: number, y: number) {
  const box = $('aksiyon');
  selectedStructure = index;
  if (index === null || !parts[index]) { box.hidden = true; return; }
  $('aksiyon-yazi').textContent = parts[index].label;
  box.style.left = `${x}px`;
  box.style.top = `${y}px`;
  box.hidden = false;
}
$('aksiyon-gizle').addEventListener('click', () => {
  if (selectedStructure !== null) setVisible(selectedStructure, false);
  $('aksiyon').hidden = true;
  selectedStructure = null;
});

// ---- Sections ---------------------------------------------------------------------------------

function setupClipRanges() {
  const box = viewer?.bounds();
  if (!box || box.isEmpty()) return;
  const axes = [[box.min.x, box.max.x], [box.min.y, box.max.y], [box.min.z, box.max.z]];
  document.querySelectorAll<HTMLInputElement>('#kesitler input[type=range]').forEach((r) => {
    const [lo, hi] = axes[+(r.dataset.eksen ?? 0)];
    r.min = String(Math.floor(lo));
    r.max = String(Math.ceil(hi));
    r.value = String((lo + hi) / 2);
    r.disabled = true;
    syncSlider(r);
  });
  document.querySelectorAll<HTMLInputElement>('#kesitler input[type=checkbox]').forEach((c) => {
    c.checked = false;
    viewer?.setClip(+(c.dataset.eksen ?? 0), false, 0);
  });
}

function syncSlider(el: HTMLInputElement) {
  el.style.setProperty('--dolu', `${((+el.value - +el.min) / (+el.max - +el.min)) * 100}%`);
}

document.querySelectorAll<HTMLInputElement>('#kesitler input[type=checkbox]').forEach((c) => c.addEventListener('change', () => {
  const axis = +(c.dataset.eksen ?? 0);
  const r = document.querySelector<HTMLInputElement>(`#kesitler input[type=range][data-eksen="${axis}"]`) as HTMLInputElement;
  r.disabled = !c.checked;
  viewer?.setClip(axis, c.checked, +r.value);
}));
document.querySelectorAll<HTMLInputElement>('#kesitler input[type=range]').forEach((r) => r.addEventListener('input', () => {
  syncSlider(r);
  viewer?.setClip(+(r.dataset.eksen ?? 0), true, +r.value);
}));

// ---- Measuring --------------------------------------------------------------------------------

function renderTool(tool: MeasureKind | null) {
  document.querySelectorAll<HTMLButtonElement>('.arac').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.arac === tool)));
  $('aksiyon').hidden = true;
  const hint = $('ipucu');
  if (tool) {
    hint.textContent = tool === 'distance' ? 'Click two points on the model. Esc to finish.' : 'Click three points; the middle one is the vertex. Esc to finish.';
    hint.hidden = false;
  } else renderHint();
}

function renderMeasurements(list: Measurement[]) {
  const ul = $('olculer');
  ul.replaceChildren();
  for (const m of list) {
    const li = document.createElement('li');
    const id = document.createElement('span');
    id.textContent = m.id;
    const value = document.createElement('b');
    value.textContent = m.value;
    const del = document.createElement('button');
    del.className = 'sil';
    del.type = 'button';
    del.textContent = '×';
    del.setAttribute('aria-label', `Delete ${m.id}`);
    del.addEventListener('click', () => viewer?.removeMeasurement(m.id));
    li.append(id, value, del);
    ul.append(li);
  }
}

document.querySelectorAll<HTMLButtonElement>('.arac').forEach((b) => b.addEventListener('click', () => {
  const kind = b.dataset.arac as MeasureKind;
  viewer?.setTool(viewer.tool === kind ? null : kind);
}));
window.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  viewer?.setTool(null);
  $('aksiyon').hidden = true;
});

// ---- View controls ----------------------------------------------------------------------------

document.querySelectorAll<HTMLButtonElement>('#kup button').forEach((b) => b.addEventListener('click', () => viewer?.viewFrom(b.dataset.yuz ?? 'z')));
document.querySelectorAll<HTMLButtonElement>('[data-cevir]').forEach((b) => b.addEventListener('click', () => viewer?.rollView(b.dataset.cevir === 'saat' ? 1 : -1)));
$('sigdir').addEventListener('click', () => viewer?.fit());

$('goruntu').addEventListener('click', async () => {
  if (!viewer) return;
  const dark = document.documentElement.dataset.theme === 'dark';
  const logo = LOGO.replaceAll('var(--logo-monogram)', dark ? '#FFFFFF' : '#26497F').replaceAll('var(--logo-kelime)', '#4CB088');
  const blob = await viewer.snapshot(dark ? '#244870' : '#F7F8FA', dark ? '#C9D2DD' : '#5A6675', logo, `${caseLine} · ${today}`, dark);
  const a = document.createElement('a');
  a.download = 'vimics-design.png';
  a.href = URL.createObjectURL(blob);
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
});

$('tema').addEventListener('click', () => {
  const root = document.documentElement;
  if (root.dataset.theme === 'dark') delete root.dataset.theme;
  else root.dataset.theme = 'dark';
  viewer?.requestRender();
});

// ---- Start ------------------------------------------------------------------------------------

if (!document.createElement('canvas').getContext('webgl2')) {
  show('error');
  $('hata-metin').textContent = 'This browser cannot show 3D graphics. Use a current version of Chrome, Edge, Safari or Firefox with hardware acceleration turned on.';
  $('yeniden').hidden = true;
} else if (sessionStorage.getItem(OPENED) === manifest.id) openCase();
else show('gate');
