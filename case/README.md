# How to publish a case

This folder is the case the DVM sees at https://vimics.vet/design-check/. Whatever is in here goes live. There is one case at a time, so a new case replaces the old one.

**Everything in this folder is public.** Anyone can download the STL files and read the names, here and on the website.

## In short

Put the STLs in this folder, named `<name>.<tag>.stl`, for example `TPLO plate 3.5 mm.metal.stl`. The five tags are `bone`, `metal`, `resin-white`, `resin-clear` and `screw`. Then type the DVM name, patient name and note into `case.json`. The steps below do it on github.dev, the editor in your browser, all in one save, so a mix of old and new files never goes live. You can also just ask an agent with the files and names.

If a file is misnamed or `case.json` is broken, the website doesn't update and the live page stays as it was. The error says in plain words which file is wrong.

## 1. Name the STL files

Rename each file on your computer before uploading: `<name>.<tag>.stl`

- The **name** is what the DVM sees in the list, for example `Amputated Tibia` or `TPLO plate 3.5 mm`.
- The **tag** says what it's made of, and sets its colour:

| Tag | Shows as |
|---|---|
| `bone` | Ivory |
| `metal` | Metal grey |
| `resin-white` | White |
| `resin-clear` | Clear, like a surgical guide |
| `screw` | Dark blue |

Examples: `Amputated Tibia.bone.stl`, `ITAP.metal.stl`, `Cutting guide.resin-clear.stl`, `Screw 1.screw.stl`

## 2. Know what goes in case.json

```json
{
  "dvm": "Onur Demirak",
  "patient": "Karamel",
  "note": "ITAP"
}
```

- `dvm`: the DVM's first and last name.
- `patient`: the patient's name.
- `note`: a short note shown beside the model. It can be empty: `""`.

The DVM must type the same two names to open the case. Capital letters, extra spaces and Turkish letters don't matter: "onur demirak" opens "Onur Demirak", and "Yilmaz" opens "Yılmaz".

Keep the quotes and the commas exactly as above. A missing comma or quote is the most common mistake.

## 3. Swap the case, all in one save

1. Open https://github.dev/vimics/design-check. Sign in to GitHub if it asks.
2. On the left, open the `case` folder.
3. Delete the old STL files: right-click each one, then **Delete**. Leave `case.json` and `README.md`.
4. Drag the new STL files from your computer into the `case` folder.
5. Click `case.json` and change the names and note.
6. Click the **Source Control** icon on the far left (it looks like a branch). Type a short message such as `Case: Karamel`, then click **Commit & Push**.

Files over 25 MB may not upload from the browser. If one fails, ask an agent to add it.

## 4. Check that it went live

1. Go to https://github.com/vimics/design-check/actions and wait for the top **Deploy** run to finish, about 2 minutes.
2. **Green tick:** it's live. Open https://vimics.vet/design-check/, type the two names, and check that every part shows. Then send the link to the DVM.
3. **Red cross:** nothing changed on the website. Click the run, then **build**, then **npm test**. The message says what's wrong and names the file. Fix it the same way as step 3.
