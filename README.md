# Design Viewer (Vimics)

A page at https://vimics.vet/design-check/ where a DVM reviews the implant design Vimics prepared for their patient. They type their own name and the patient's name. If both match the current case, the 3D viewer opens: rotate, section, measure distances and angles, show or hide each part, see through bone, and save a snapshot.

It isn't linked from vimics.vet. Umut sends the link to the DVM.

**The name check is a soft check.** The STL files and the names are public in this repository and on the site, so anyone who looks can download them, and every past case stays in the Git history. Umut chose this on 2026-11-04.

## Publish a new case

**In short:** put the STLs in the `case` folder, named `<name>.<tag>.stl`, for example `TPLO plate 3.5 mm.metal.stl`. The five tags are `bone`, `metal`, `resin-white`, `resin-clear` and `screw`. Then type the DVM name, patient name and note into `case.json`. The steps below walk through it on github.dev, the in-browser editor, as one commit, so a mix of old and new files never goes live. You can also just ask an agent with the files and names.

If a file is misnamed or `case.json` is broken, the deploy stops and the live page stays as it was. The error says in plain words which file is wrong.

The `case` folder holds the one case that is live:

```
case/
  case.json
  Tibia.bone.stl
  TPLO plate 3.5 mm.metal.stl
  Cutting guide.resin-clear.stl
  Screw 1.screw.stl
```

**1. Name each STL `<name>.<tag>.stl`.** The name is what the DVM sees in the list. The tag sets the look:

| Tag | Looks like |
|---|---|
| `bone` | Ivory, as in V-Seg |
| `metal` | Metal grey |
| `resin-white` | White |
| `resin-clear` | Clear, like a surgical guide |
| `screw` | Dark blue |

**2. Write `case.json`.** The DVM must type the same names. Case, spaces and accents don't matter. The note is optional and shows in the sidebar.

```json
{
  "dvm": "Ayşe Yılmaz",
  "patient": "Max",
  "note": "TPLO plate 3.5 mm, 6 holes. Screws 2.7 mm."
}
```

**3. Swap the case in one commit**, so no mix of old and new ever goes live:

1. Open https://github.dev/vimics/design-check (or press `.` on the repository page).
2. In the `case` folder, delete the old STL files.
3. Drag the new STL files into the `case` folder.
4. Open `case.json` and change the names and note.
5. Open Source Control (the branch icon on the left), write a message such as "Case: Max", and choose **Commit & Push**.

Or ask an agent: "Publish this case: these STLs, DVM ..., patient ...". STL files over about 25 MB need an agent.

**4. Check it went live.** On github.com, the **Actions** tab shows a **Deploy** run, which takes about 2 minutes. If it turns red, open it: the `npm test` step says in plain words what is wrong, naming the file. The site stays as it was until it passes.

**5. Try it yourself** at https://vimics.vet/design-check/ with the names, then send the link to the DVM.

## Run it locally

```sh
npm install
npm run dev        # local preview of the case in case/
npm test           # unit tests, including a check of case/
npm run test:e2e   # browser tests, against the fixture case in e2e/fixture-case (first: npx playwright install chromium)
npm run build      # type check and build into dist/
```

## How it is organised

| Path | What it does |
|---|---|
| `case/` | The live case: STL files and `case.json` |
| `plugins/case.ts` | Checks the case folder and publishes each STL gzipped |
| `src/app/` | Name check, sidebar, structures list, measurements, sections, snapshot |
| `src/engine/stl.ts` | Reads binary and ASCII STL, merges shared corners, keeps sharp edges sharp |
| `src/engine/load.worker.ts` | Downloads and reads the STLs in the background |
| `src/engine/viewer/` | The 3D viewer, copied from V-Seg (`vimics/segmentation`) and adapted for parts |
| `e2e/fixture-case/` | Simple shapes the browser tests use, so they never depend on the live case |

Viewer design is informed by [Online3DViewer](https://github.com/kovacsv/Online3DViewer) (MIT), through V-Seg. No code from it is included.
