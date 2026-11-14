# Patch Notes

The `/patch-notes` page shows what changed in each ESR release: the mod author's patch notes and, where we made them,
our own reports. `/patch-notes/<version>` opens one release (`/patch-notes` alone opens the newest), `?view=items` or
`?view=check` one of its reports. A timeline lists the releases grouped by minor version (ESR 3.3, ESR 3.2); on narrow
pages it becomes a select. The home page's version line links "What changed in <version>" for the game files' version,
and the menu lists it last in the Items group (a ninth top-level entry does not fit the header).

## Views

| View             | Source                                                                       |
| ---------------- | ---------------------------------------------------------------------------- |
| Patch notes      | `patchnotes/<version>.md` in the ESR repository, rendered in the app's theme |
| Item changes     | our unique and runeword change report (HTML + PDF), old → new per item       |
| Patch-note check | our patch notes vs game files check (`npm run esr:changelog`, HTML + PDF)    |

The reports are A4 print layouts with their own light colours. The page shows them in a sandboxed frame (no scripts,
same origin so the page reads their height and adds a screen margin) as a white sheet, also in dark mode; under ~46rem
the sheet scrolls sideways instead of squeezing the tables. "Open full page" opens the HTML file, "Download PDF" the
PDF. Releases older than the patch-note files (before 3.2.04) are only linked: the official changelog page. That page
stopped at 3.2.02 and uses an older numbering too (it has a 3.3.04 from April 2025), so versions are never matched
against it.

## Data

`public/patch-notes/`, written by `npm run patch-notes:generate` (also run by `game-data:generate`; `game-data:check`
checks `index.json`):

- `index.json` (`PatchNotesIndex`, `src/features/patch-notes/engine/schema.ts`): releases newest first, each with its
  date (the ESR release tag's date; a release without a tag has none, and a date stays once known because shallow
  clones only fetch the newest tags), the GitHub URL of its markdown file, the notes parsed into blocks
  (`patchNoteMarkdown.ts`: bold-only lines are headings, `*` bullets nest by indent, `**bold**` runs, escapes; the
  notes' own "Eastern Sun Resurrected x.y" title line is dropped) and its reports.
- `reports/<version>-item-changes.{html,pdf}` and `reports/<version>-patch-note-check.{html,pdf}`: copied from the
  local, gitignored `owner-notes/` when it exists (`ESR-<version>-unique-runeword-changes.*` and
  `esr-<version>-changelog-check.*`). Flat file names so no public folder shadows a `/patch-notes/<version>` route. A
  report is listed when its HTML exists; the PDF is optional. A report without patch notes still gets a release.

Publishing a new report: put both files in `owner-notes/` under those names, run `npm run patch-notes:generate`, read
the HTML for anything that should not be public, commit `public/patch-notes/`. The `/esr-update` skill does this at
its end (step 9).

## Files

| Path                                               | What                                                                |
| -------------------------------------------------- | ------------------------------------------------------------------- |
| `scripts/generate-patch-notes.ts`                  | the command (`--esr <dir>`, `--check`)                              |
| `scripts/lib/patchNotesFiles.ts`                   | fs side: patch-note files, tag dates, owner-notes copy, write/check |
| `src/features/patch-notes/build/`                  | pure: markdown parser, `buildPatchNotesIndex`, report file names    |
| `src/features/patch-notes/screens/`                | `PatchNotesScreen` (release, views, toolbar)                        |
| `src/features/patch-notes/components/`             | `ReleaseTimeline` / `ReleasePicker`, `PatchNoteBody`, `ReportSheet` |
| `src/features/patch-notes/utils/patchNotesView.ts` | views, paths, grouping, dates                                       |
