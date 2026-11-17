# Prova · vimics.vet/prova

A static page from Vimics. A DVM types their name and the patient's name, and if both match one of the live cases, sees that implant design (STL files) in 3D. Several cases are live at once, one folder each in `cases/`. Umut and teammates who don't code add and remove cases following `cases/README.md`. Keep that file plain and in step with how the case check works.

Umut and Onur build this by working with AI agents. Explain what you change in plain words.

## How it fits together

| Address | Repository | Notes |
|---|---|---|
| vimics.vet | `vimics/vimics.github.io` | Main site, owned by Onur. Don't change it for this tool |
| vimics.vet/segmentation/ | `vimics/segmentation` | V-Seg. Don't change it for this tool |
| vimics.vet/prova/ | `vimics/prova` (this repo) | Prova |

- Every push to `main` goes live. `.github/workflows/deploy.yml` runs the unit tests, which include a check of every folder in `cases/`, then builds into `dist/` and publishes. If the tests fail, the live site stays as it was.
- `dist/` is built, never committed. Keep paths relative, because the site runs from a subfolder.
- Never add a `CNAME` file. Repository and Pages settings are changed by Onur only.
- **Never link this tool from vimics.vet or V-Seg.** Umut sends the link himself.

## Before every push: pull first

1. At the start of a session, run `git fetch origin && git status -sb` and tell the person if they are behind or have uncommitted work.
2. Push finished work without asking. Before pushing, always:
   ```sh
   git pull --rebase origin main
   npm test && npm run build
   git push origin main
   ```
3. If the push is rejected, pull again with `--rebase`. Never use `--force`, and never change commits that are already pushed.
4. After pushing, check the deploy with `gh run list --workflow Deploy --limit 1`, then open the live page.

## Publishing a case for Umut

- Each case is a folder in `cases/`, named in lowercase after the patient, for example `cases/karamel/`. It holds the STLs as `<label>.<tag>.stl` and a `case.json` with `dvm`, `patient` and `note`. Add a case in one commit, and leave the other cases alone unless Umut says to remove one.
- Two cases can't share the same DVM and patient names. The tests refuse it.
- The tags are exactly these six: `bone`, `tumor`, `metal`, `resin-white`, `resin-clear`, `screw`. Don't add more unless Umut asks.
- Run `npm test` before pushing. Then open the live page with the names and check that every part shows.

## Rules that must not break

- The name check is soft, by Umut's choice on 2026-11-04: STLs and names are public in the repo, and since 2026-11-17, with several cases live, a DVM who reads the page's code could find other cases. Don't describe it as secure or private.
- Keep `<meta name="robots" content="noindex">`.
- Page text: no CE or FDA claims, no "best", "leading", "only" or "first", no guarantees, exclamation marks, emoji, prices or phone numbers.
- Axes are only X, Y and Z, with no left or right labels. Units are millimetres.
- The viewer started as a copy of V-Seg's `src/engine/viewer/` at commit `81c6280`. A fix there may be worth bringing here, and the other way round. Neither repo imports from the other.
- Keep it light: `three` is the only runtime dependency.
- Reply in the language the person writes in.
