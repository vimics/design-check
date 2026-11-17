# How to add or remove a case

This folder holds the cases DVMs see at https://vimics.vet/design-check/. Each case is its own folder in here, such as `cases/karamel/`. Every case folder goes live, and several cases can be live at the same time. A DVM types their name and the patient's name, and the page opens the case that matches.

**Everything in this folder is public.** Anyone can download the STL files and read the names, here and on the website. All the live cases' names are in the page's code too, so a DVM who knows where to look could find and open another DVM's case.

## In short

Make a folder for the case, named after the patient in lowercase, for example `karamel`. Put the STLs in it, named `<name>.<tag>.stl`, for example `TPLO plate 3.5 mm.metal.stl`. The six tags are `bone`, `tumor`, `metal`, `resin-white`, `resin-clear` and `screw`. Then add a `case.json` with the DVM name, patient name and note. To take a case down, delete its folder. The steps below do it on github.dev, the editor in your browser, all in one save. You can also just ask an agent with the files and names.

If a file is misnamed or a `case.json` is broken, the website doesn't update and the live page stays as it was. The error says in plain words which case folder and which file is wrong.

## 1. Name the STL files

Rename each file on your computer before uploading: `<name>.<tag>.stl`

- The **name** is what the DVM sees in the list, for example `Amputated Tibia` or `TPLO plate 3.5 mm`.
- The **tag** says what it's made of, and sets its colour:

| Tag | Shows as |
|---|---|
| `bone` | Ivory |
| `tumor` | Rust brown |
| `metal` | Metal grey |
| `resin-white` | White |
| `resin-clear` | Clear, like a surgical guide |
| `screw` | Dark blue |

Examples: `Amputated Tibia.bone.stl`, `Osteosarcoma.tumor.stl`, `ITAP.metal.stl`, `Cutting guide.resin-clear.stl`, `Screw 1.screw.stl`

## 2. Know what goes in case.json

Each case folder has its own `case.json`:

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

Two cases can't have the same DVM and patient names, because only one could open. Two cases for the same DVM with different patients are fine.

Keep the quotes and the commas exactly as above. A missing comma or quote is the most common mistake.

## 3. Add a case, all in one save

1. Open https://github.dev/vimics/design-check. Sign in to GitHub if it asks.
2. On the left, right-click the `cases` folder, then **New Folder**. Name it after the patient in lowercase, for example `karamel`.
3. Drag the STL files from your computer into that new folder.
4. Copy `case.json` from another case folder into the new one: right-click it, **Copy**, then right-click the new folder, **Paste**. Click the copy and change the names and note.
5. Click the **Source Control** icon on the far left (it looks like a branch). Type a short message such as `Case: Karamel`, then click **Commit & Push**.

Leave the other case folders alone. They stay live.

Files over 25 MB may not upload from the browser. If one fails, ask an agent to add it.

## 4. Remove a case

When a DVM is done with a case, take it down so the site stays small. Each case is about 30 MB, and the whole site must stay under about 1 GB.

1. In github.dev, right-click the case's folder inside `cases`, then **Delete**.
2. Commit and push as in step 3.5, with a message such as `Remove case: Karamel`.

The link stops opening that case. The files stay in the Git history.

## 5. Check that it went live

1. Go to https://github.com/vimics/design-check/actions and wait for the top **Deploy** run to finish, about 2 minutes.
2. **Green tick:** it's live. Open https://vimics.vet/design-check/, type the two names, and check that every part shows. Then send the link to the DVM.
3. **Red cross:** nothing changed on the website. Click the run, then **build**, then **npm test**. The message says what's wrong and names the case folder and the file. Fix it the same way as step 3.
