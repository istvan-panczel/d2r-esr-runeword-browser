# esr-update reference

Read by the `/esr-update` skill before step 4. Background docs: `docs/features/GAME-DATA.md` (Regenerating),
`docs/features/GUIDE.md` (Body syntax, Staleness), `docs/features/LOOT-FILTER.md`, `docs/features/STASH.md`.

## Tools

| Command                           | What it does                                                                                                                                                                                                                                                                                                                    |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run game-data:update`        | Pull the clone (`--tag`, `--no-pull`), keep `test-fixtures/previous/`, generate bundles + icons + guide + sitemap, refresh fixtures (`--no-fixtures`), `game-data --check`, `guide:check`, full test suite, summary. Never commits.                                                                                             |
| `npm run esr:diff`                | What changed in the clone between two revisions: launcher versions, patch notes, changelog, tables (marked "read by the app"), strings, docs (once per page with its locales), launcher configs, `LootFilters/`, everything else. `--from/--to`, `--json`, `--out`.                                                             |
| `npm run esr:review`              | Read-only review of the regenerated working tree against `HEAD` (the previous version), the clone and the live sites; every check below. `--out x.md` (+ `x.json`), `--json`, `--offline`, `--from <rev>`. Exit 0 when it ran (findings included), 2 when it cannot run.                                                        |
| `npm run esr:user-data`           | Read-only GET scan of PROD (publishable key from `.env.production`): public builds (every variant and alternative item), `favorite_counts`, public loot filters; lists references that no longer resolve in the new data. `--review <review.json>` also lists ids the review's findings mention. Exit 2 without env or network. |
| `npm run guide:report` / `:check` | Guide freshness report / the committed guide is current.                                                                                                                                                                                                                                                                        |

The review derives every baseline from `HEAD`, so this file holds no counts to keep in sync. The integrity test
(`src/features/game-data/bundleIntegrity.test.ts`) and `src/features/game-data/runtimeConstants.test.ts` pin the
numbers and ids that matter.

## Review checks: what a finding means and what to do

| Check id                                             | A finding means                                                                                                                                                                                                               | Action                                                                                                                                                                                       |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `versions.manifest`                                  | the working tree is not at the new tag                                                                                                                                                                                        | rerun step 1 with `--tag`                                                                                                                                                                    |
| `versions.clone-tag`                                 | the clone's HEAD is untagged                                                                                                                                                                                                  | update to a tag unless the owner asked for `main`                                                                                                                                            |
| `versions.mod-version`                               | `d2rloader/metadata.json` `modVersion` ≠ tag; the app labels data (and builds, filters, `guide:verify`) with it                                                                                                               | **stop and ask** (SKILL step 3.3)                                                                                                                                                            |
| `versions.launcher`                                  | D2RLoader / game version / game build / save mode changed: the stash `.d2i` parser's format constants may be stale                                                                                                            | ask the owner for a fresh `ModernSharedStashSoftCoreV2.d2i` in `test-fixtures/stash/`, run `npx vitest run src/features/stash`; otherwise report "stash format unverified"                   |
| `manifest.counts`, `manifest.warnings`               | counts moved / warnings appeared                                                                                                                                                                                              | explain each with the release diff (e.g. "+2 runewords: patch note adds X, Y"); a new warning class is a red flag; unexplained → investigate the table diff, report                          |
| `bundle.<file>`                                      | entries added / removed / changed by name                                                                                                                                                                                     | spot-check against the patch notes; renamed names break guide directives and saved builds                                                                                                    |
| `skills.ids`                                         | skill ids renamed or removed                                                                                                                                                                                                  | builds store points by id and `/skills?skill=<id>` links break: report with the user-data scan's numbers                                                                                     |
| `sources.unknown`                                    | new items with no known source                                                                                                                                                                                                | report; the Drop Finder / guide may need a note                                                                                                                                              |
| `ids.lootfilter`, `ids.stashnames`, `ids.itemtext`   | an id now names another row (a row inserted mid-table)                                                                                                                                                                        | players' saved filters and old stash files silently point at other items: report as high priority with the user-data scan                                                                    |
| `ids.stash`                                          | a stat's save width changed                                                                                                                                                                                                   | old stash files parse differently: the stash fixture test must still pass; ask for a fresh save                                                                                              |
| `builds.crafts`                                      | a corruption / anointment / forging outcome changed at the same `slot:roll` / `kind:key`                                                                                                                                      | saved builds silently show another outcome: report with the user-data scan                                                                                                                   |
| `cube.fallback`                                      | rows no cube family regex matched grew                                                                                                                                                                                        | a cubemain `description` changed shape: follow-up for `src/features/game-data/build/cube/cubeFamilies.ts`                                                                                    |
| `cube.ops`                                           | a cube condition `op` the app does not know                                                                                                                                                                                   | the Cube page skips it silently: follow-up (`STAT_OPS` in `bundleCube.ts`)                                                                                                                   |
| `guide.recipes`                                      | a `::recipes` block newly hit its cap or lost rows                                                                                                                                                                            | a finding to report, never to hide; check the expected shapes below                                                                                                                          |
| `guide.data-blocks`, `guide.patch-notes`             | notes whose data changed / notes naming patch-note terms                                                                                                                                                                      | the guide agent rereads them                                                                                                                                                                 |
| `icons.missing`, `icons.vanilla-art`, `icons.inputs` | items without an icon / no vanilla art folder / changed art inputs                                                                                                                                                            | list names so the owner can ask the mod author for art; without the folder see SKILL step 1                                                                                                  |
| `variants.runewords`, `variants.gemwords`            | a `name:variant` now has another recipe or vanished (variants are page order)                                                                                                                                                 | favourites (`runeword:Name:N`) and build slots point elsewhere: report with the user-data scan                                                                                               |
| `lootfilter.plugin`                                  | the loot-filter DLL version ≠ `LOOT_FILTER_PLUGIN_VERSION` (`src/features/loot-filter/utils/template.ts`)                                                                                                                     | propose the bump (SKILL question 3) and list what to re-verify in game: the evaluator rules, `STAT_QUIRKS`, JSONC parsing; also re-read the changed DLL toml / PDF guide in the release diff |
| `lootfilter.sources`                                 | `LootFilters/sources.json` changed (the filters the launcher pulls live)                                                                                                                                                      | report; a new or replaced template repo is a follow-up                                                                                                                                       |
| `lootfilter.template`, `lootfilter.assets`           | Sully's upstream QoL filter is newer / its icon or sound names differ                                                                                                                                                         | refresh (below)                                                                                                                                                                              |
| `lootfilter.validate`                                | the bundled template or example filter gained diagnostics against the new data                                                                                                                                                | a rule's code, id or stat is gone or (after an id shift) means another item: report; never edit Sully's copy by hand                                                                         |
| `docs.lag`                                           | a table behind the parsed docs pages (`runes.txt`, `gems.txt`, `uniqueitems.txt`) changed but none of the pages the app parses did (finding), or only that table's pages did not (info: maybe columns the page does not show) | the docs were probably not regenerated: the runeword, gemword, socketable and unique pages show old data next to new bundle pages; ask the mod author to regenerate the docs                 |
| `net.docs-site`                                      | a live HTM page differs from the clone's `docs/` (the site lags or was regenerated later)                                                                                                                                     | report; if the docs change after the version bump, recommend a patch release so cached users refetch                                                                                         |
| `net.links`, `net.discord`                           | an official or community URL is not 200 / the invite expired                                                                                                                                                                  | fix official URLs (below); report community tools and the invite                                                                                                                             |
| `docs.old-version`                                   | files quoting the old version                                                                                                                                                                                                 | update them (below)                                                                                                                                                                          |
| `self.coverage`, `self.commits`                      | data the review does not know / feature commits since the skill changed                                                                                                                                                       | SKILL step 8                                                                                                                                                                                 |

**Terror zones**: `terrorzones.json` regenerates from `data/hd/global/excel/desecratedzones.json` (not a `.txt` table,
so `esr:diff` lists it under "other files"; names from levels.txt / levelgroups.txt / areas.json). A changed seed, start,
duration, zone list or zone order (`bundle.terrorzones.json` `config` / `zones`) changes **every** slot of the schedule:
say so in the release summary, check the ESR ground truth in `src/features/terror-zones/engine/schedule.test.ts`
(it fails then: re-check the zones in game and replace the dated ESR slots) and note that players' watched groups
(`terrorZones.watched`, zone ids in localStorage) are ignored for ids that no longer exist. **More than one config** in
desecratedzones.json makes `game-data:generate` fail (`terrorzones: … configs, the app schedules only one`): the app
schedules only one. Ask the owner; supporting it means choosing the config covering each time (the game uses the first
in file order with `start <= t < end`) in `src/features/terror-zones/engine/schedule.ts` and the bundle shape. An
unreadable `start_time_utc` / `end_time_utc` (not `YYYY-MM-DD HH:MM:SS`) fails it too. See
`docs/features/TERROR-ZONES.md`.

Known genuine data, not findings: Sully's template validates with 6 warnings at 3.2.24 (`item_addskill_tab` on rules
31–33, `docs/features/LOOT-FILTER.md`); the official `changelogs.html` stopped at 3.2.02 (patch notes live in the
repo's `patchnotes/`); `modinfo.json` in the clone is stale upstream (3.2.09), ignore it.

## Review agents (SKILL step 4)

Spawn all three in one message, `model: opus`, `subagent_type: general-purpose`. Each brief starts with: "READ-ONLY
review for the /esr-update of the D2R ESR Runeword Browser at <repo path>, ESR <old> → <new>. Do not edit, stage or
commit anything in the repo or the ESR clone at <clone path>. Write your result to <$S>/<file>. Return findings as
`severity | claim | evidence (file:line, command output) | proposed action`, most severe first; say what you could
not check." Then:

1. **data-review** → `data-review.md`. Read `$S/summary.md`, `$S/diff.txt`, `$S/review.md`, `$S/update.log`,
   `$S/user-data.txt`. Explain every count change, warning, bundle change, id shift, variant shift, craft change and
   test failure with the release diff (table rows, patch notes). Name what breaks for players or saved data and how
   many public builds / favourites / filters the scan found. Propose the exact integrity-test pin changes and the
   doc-count updates (file, old → new, source of the new number).
2. **guide-review** → `guide-edits.md` plus a unified diff `guide-edits.patch` against `content/guide/`. Read
   `$S/summary.md`, the review's `guide.*` checks, `npm run guide:report`, and every note named there or touching a
   changed system (`grep -rn -i '<term>' content/guide`). Follow "Guide rules" below. Number every edit with a
   one-line description. Do not apply the patch.
3. **external-review** → `external-review.md`. Read the review's `lootfilter.*`, `net.*` and `versions.launcher`
   checks and the release diff's launcher and `LootFilters/` sections. For a newer Sully template: list the upstream
   version, changed rules, new or removed icons and sounds. For dead or moved official URLs: find the new URL on the
   official site (its navigation, `docs/` in the clone) and propose the edit. For a plugin version change: read the
   changed toml / PDF guide and list the evaluator or quirk rules to re-verify in game.

## Applying edits (SKILL step 5)

- **Guide**: `git apply "$S/guide-edits.patch"`, then fix build errors in `content/guide` (never by loosening the
  generator). Keep notes ≤ ~250 words (build warns above 400); new stubs are drafts (no `verified:`), slugs must not be
  reserved (`RESERVED_SLUGS` in `src/features/guide/build/parseNote.ts`: `map`).
- **Pins**: edit the expected numbers in `bundleIntegrity.test.ts` (and other pinned tests the full suite flagged) only
  where the data agent explained them.
- **Docs quoting the old version**: in the files `docs.old-version` lists, replace the version and update the counts
  that come straight from the new manifest or bundles; leave historical statements ("added in 3.2.20") alone; list
  what you could not derive.
- **Sully's template**: download the upstream `Sullys-QoL-Filter.json` verbatim to
  `public/loot-filters/sullys-qol-filter.json`, add or remove the icons / sounds under `public/loot-filters/` to match
  upstream, update `SULLYS_QOL_TEMPLATE.version` / `.credit` in `src/features/loot-filter/utils/template.ts` and the
  version in `docs/features/LOOT-FILTER.md`, then rerun `npm run esr:review -- --offline` (`lootfilter.validate` must
  not gain diagnostics) and `npx vitest run src/features/loot-filter`.
- **Official links**: `OFFICIAL_LINKS` / URL constants in `src/core/navigation/navConfig.ts`, `OFFICIAL_REFERENCES` in
  `src/features/guide/utils/guideHome.ts`, `docs:` links in `content/guide`. Community tools: report only.

### Guide rules

- Every fact comes from the release diff, the game files or an existing `_sources.yml` source; no invention.
- Never type a number a directive can provide (`::recipes`, `::source`, `::vendor`, `::secret-recipes`,
  `::difficulty-penalties`, `::card`); link to the data instead.
- Prose telling the player to farm or find an item may carry one `[label](<dropfinder:Item Name>)` link per paragraph.
- Launcher facts: notes cite launcher plugins and patches (`esr-loader` in `_sources.yml`, e.g.
  `d2rloader/patches/auto-collect-corpse.json`); a changed patch/config changes the note
  (`grep -ln esr-loader content/guide/notes/*.md`).
- Leave `verified:` and `content/guide/.verify-lock.json` untouched.
- Expected `::recipes` shapes: `rune-conversion` (rune-families) has one "Ancient Decal (X -> Y) + X Rune → Y Rune"
  row and one "An LoD rune … → The ES rune and the Ancient Decal" row; `rune-forging` (forging) 3 rows;
  `legendary-consumables` (enhancement-order) shows the Halo as "The same item + A copy of the item (Branded)". At
  3.2.24 the coupons, noobs-charm and rune-families blocks sit at the 12-row cap.

## Commits (SKILL step 7)

1. `chore(game-data): update to ESR <version>`: `public/game-data/`, `public/guide/`, `public/sitemap.xml`, the
   integrity-test and other pin updates, the doc version/count updates.
2. `docs(guide): <what changed> for ESR <version>`: `content/guide/` and the regenerated `public/guide/`.
3. `chore(loot-filter): refresh Sully's QoL template to v<x>`: the template, its assets, `template.ts`, the docs.
4. `fix(nav): update moved official ESR links`: link fixes.
5. `chore(loot-filter): bump the loot filter plugin version to <x>`: only after approval.
6. `chore(esr-update): …`: skill or review-script edits, only after approval.

The game-data commit stages ~1,700 icon files at most; the hooks skip `public/game-data` for Prettier, the size guard
and gitleaks, and the exiftool check takes a few seconds.

## When things go wrong

- **ESR clone dirty or on another branch**: the update aborts. Show `git -C <clone> status`; ask before cleaning or
  checking out. Untracked `.DS_Store` files are ignored.
- **Tag not found**: confirm the name (`git ls-remote --tags origin` in the clone; no `v` prefix).
- **Release diff empty or a revision missing**: the clone is shallow; esr:diff and esr:review fetch the old revision
  on demand. If that fails, ask before `git fetch --unshallow`.
- **Vanilla art folder missing**: icons.json keeps the old `esrVersion`, so `game-data --check`, the icon check and
  `bundleIntegrity.test.ts` fail. Only `npm run game-data:icons` with the folder fixes it; never hand-edit icons.json.
- **New generator warnings** (string conflicts, duplicate bases, unresolved stats, `affix stats: property … is not
mapped`, `lootfilter skills:`, `stash:`, `itemtext:` missing strings): find the rows in the table diff and explain
  them; a parser gap is a follow-up, not a silent code fix.
- **Integrity test fails**: if the release diff explains the new count, update the pin (step 5); otherwise
  investigate. It also pins `r48` Fu Rune as the only spawnable item that never drops, disabled uniques 0 and 690–695,
  the five map tiers at 4 zones on the 100–108 ladder, The Hidden Vault, the five towns, and every cube family keeping
  a row; it compares all bundles with a fresh build.
- **runtimeConstants.test.ts fails**: a stat id or descfunc the stash parser, stat text or loot filter hard-codes
  moved: report it with the release diff; the fix is app code (ask).
- **Other tests fail** (data-sync parsers on the new HTM fixtures, loot filter, builds, stash, guide): compare with
  `test-fixtures/previous/`; a renamed item in the docs vs the tables is a data mismatch to report, not to hide. Stash
  fixture tests skip without the owner's `.d2i` in `test-fixtures/stash/`: say so.
- **`game-data --check` / `guide:check` fails after a rerun**: non-deterministic output; report it.
- **Guide build errors**: unknown `rw:`/`unique:`/`socketable:`/`base:`/`dropfinder:` target or `::source` name → use
  the new name from the strings diff (add `{item=…}` when ambiguous); unknown `::recipes` family → the cubemain
  description changed, report it; dead `docs:` anchor → find the new anchor in the changed docs page; unknown `:term`
  → add it to `_glossary.yml` or fix the spelling.
- **A pre-commit hook fails**: fix the cause (formatting, a flagged secret, metadata, a file over 2 MB outside
  `public/game-data`); never `--no-verify`.
- **esr:user-data exits 2**: no network or `.env.production`; say "user-data impact not checked".
