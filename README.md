# Design Viewer (Vimics)

A page at https://vimics.vet/design-check/ where a DVM reviews the implant design Vimics prepared for their patient. They type their own name and the patient's name. If both match one of the live cases, that case opens in the 3D viewer: rotate, section, measure distances and angles, show or hide each part, see through bone, and save a snapshot.

It isn't linked from vimics.vet. Umut sends the link to the DVM.

**The name check is a soft check.** The STL files and the names are public in this repository and on the site, so anyone who looks can download them, and every past case stays in the Git history. Several cases are live at once, and all their names are in the page's code, so a DVM who reads it could find and open another DVM's case. Umut chose this on 2026-11-04, and accepted it for several cases on 2026-11-17.

## Add or remove a case

The steps are in [`cases/README.md`](cases/README.md), written for teammates who only work in that folder.

## Run it locally

```sh
npm install
npm run dev        # local preview of the cases in cases/
npm test           # unit tests, including a check of cases/
npm run test:e2e   # browser tests, against the fixture cases in e2e/fixture-cases (first: npx playwright install chromium)
npm run build      # type check and build into dist/
```

## How it is organised

| Path | What it does |
|---|---|
| `cases/` | The live cases, one folder each with STL files and `case.json`. The steps are in its README |
| `plugins/case.ts` | Checks every case folder and publishes each STL gzipped |
| `src/app/` | Name check, sidebar, structures list, measurements, sections, snapshot |
| `src/engine/stl.ts` | Reads binary and ASCII STL, merges shared corners, keeps sharp edges sharp |
| `src/engine/load.worker.ts` | Downloads and reads the STLs in the background |
| `src/engine/viewer/` | The 3D viewer, copied from V-Seg (`vimics/segmentation`) and adapted for parts |
| `e2e/fixture-cases/` | Two cases of simple shapes the browser tests use, so they never depend on the live cases |

Viewer design is informed by [Online3DViewer](https://github.com/kovacsv/Online3DViewer) (MIT), through V-Seg. No code from it is included.
