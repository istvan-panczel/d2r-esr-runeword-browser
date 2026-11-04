---
name: esr-update
description: Update the app to a new Eastern Sun Resurrected (ESR) release end to end — regenerate game data, read the release diff and patch notes, review the bundles, propose guide note edits, ask the owner, optionally commit. Use when the owner says "ESR released a new version", "update the game data", "bump ESR", "new ESR patch" or runs /esr-update.
---

# ESR release update

You perform the whole update after an ESR mod release, review every change, and ask the owner at the decision points.
Arguments: an optional ESR version/tag (e.g. `/esr-update 3.2.13`). Work from the repo root. The ESR clone lives at
`../Eastern_Sun_Resurrected` unless `ESR_SOURCE_DIR` or `--esr <dir>` says otherwise.

Background docs (read only what you need): `docs/features/GAME-DATA.md` (Regenerating), `docs/features/GUIDE.md`
(Body syntax, Staleness), `scripts/update-game-data.ts`.

## 0. Preconditions

1. `git status --porcelain`: if anything is listed, stop and ask the owner (stash, commit, or abort). Never discard it.
2. `git branch --show-current`: if `master`, offer to create `chore/esr-<version>` (use the requested version, or
   `next` until you know it) and switch to it after approval.
3. Note the current version: `esrVersion`, `esrTag`, `esrCommit` from `public/game-data/manifest.json`. Keep a copy of its
   `counts` and `warnings` for the comparison in step 3 (`git show HEAD:public/game-data/manifest.json` also works later).

## 1. Regenerate

Run `npm run game-data:update` (add `-- --tag <tag>` when the owner named a version; tags have no `v` prefix). It
clones/pulls ESR, generates `public/game-data`, regenerates the item icons (ESR sprites + the vanilla art folder
`../d2r-vanilla-art`, `--vanilla <dir>` / `D2R_VANILLA_ART_DIR`; without the folder it prints a warning and keeps the
committed icons) and the skill icons (clone only), fetches the test fixtures, runs `vitest src/features/game-data`,
`game-data --check` (bundles, item icons, skill icons), `guide:generate`, `guide:check`, prints the guide freshness
report and a summary. It never commits. The vanilla art folder is outside git; if it is missing on this machine, say so
in the report: new uniques, set items or bases whose art is vanilla-only then show no icon until someone with the
folder reruns `npm run game-data:icons`.

Exit code 1 means a step failed (the summary lists each step's result). Stop, show the failing step and its output,
diagnose with the list under "When things go wrong", and ask the owner before changing anything. A fixture download
failure is only a warning.

Keep the printed summary (version/tag/commit before → after, count deltas, warnings, changed files) and the
"Guide freshness" report.

## 2. Read the release diff

Run `npm run esr:diff` (`node scripts/esr-release-diff.ts`; `-- --json` for machine-readable output, `-- --from <rev>
--to <rev>` to override the range). It compares the revision our committed manifest was built from with the clone's
HEAD and lists: new/changed patch notes (full text), new changelog-page entries, changed game tables with added/removed
row keys, changed strings, changed official docs pages (hand-written vs generated), launcher configs, other files.

Read all of it. Patch notes and changelog entries are the primary source of what changed for players; tables, strings
and docs are the secondary source that confirms or adds detail. Write a plain-language summary grouped as:

- new systems, items, recipes;
- removed things;
- renamed things (old → new name; these break guide directives and links);
- balance changes relevant to the app's data (runewords, affixes, bases, socket caps, cube recipes, vendors, drops).

If a patch note is ambiguous or contradicts the tables, say so; do not resolve it by guessing.

The launcher section matters to the guide too: notes cite the launcher plugins and memory patches as a source
(`esr-loader` in `_sources.yml`; e.g. `d2rloader/patches/auto-collect-corpse.json` is why death leaves no corpse, and
`d2rloader/config/celestialrayone.cube-cloneitem.toml` defines the `cloneitem` cube output). A changed, disabled or
removed patch/config changes a guide fact: `grep -ln esr-loader content/guide/notes/*.md` lists the notes to re-read.

## 3. Review the regenerated data

1. `git diff --stat public/game-data public/guide`.
2. Compare the summary's count deltas and warnings with the old manifest. A new warning is a red flag: explain it or
   investigate before continuing. Baseline at 3.2.24 (11 warnings, all genuine ESR data): six `bases:` lines (Scissors
   Suwayyah and Hunter's Guise outside their tier family, the three Mythical Amulet/Ring/Jewel name strings, the
   dropped `cx1`–`cx3` duplicates), three `affixes:` lines for the unknown item type `voib` (allowlisted in the
   integrity test), `skilldetails: unknown skill in oskill "Axe Swarm"` and one `crafting:` shadowed cubemain row.
   Warning classes added since: `affix stats: property … is not mapped` (a new properties.txt func; the affix browser
   cannot list that affix's stat), `lootfilter: duplicate item code` / `has unknown base code`, `cube: guide family … has
no section` and the `areas:` lines listed under `areas.json` below.
3. Spot-check the changed bundles. Each array element is one JSON line, so changed entries are the `+`/`-` lines of
   `git diff -U0`. List them by name, e.g.:
   `git diff -U0 public/game-data/runewords.json | node -e "require('fs').readFileSync(0,'utf8').split('\n').filter(l=>/^[+-] {2,}\{/.test(l)).forEach(l=>{const o=JSON.parse(l.slice(1).trim().replace(/,$/,''));console.log(l[0],o.name??o.key)})"`
   (same for `affixes.json`, `bases.json`, `sources.json`, `sets.json`). Check `counts.sourcesUnknown` and list the `unknown`
   sources: `node -e "const s=require('./public/game-data/sources.json');console.log(s.items.filter(i=>i.labels.some(l=>l.kind==='unknown')).map(i=>i.name))"`.
   Then the bundles added in v1.33.0:
   - `skills.json` / `skilldetails.json`: list added, removed and renamed skill ids (`git diff -U0` as above on
     `skilldetails.json`, key `id`). Builds store skill points by skill id and the Skills page deep-links use `?skill=<id>`,
     so a renamed id is a finding to report (builds keep the old id and show the points nowhere). Explain changes in
     `counts.skillDetails`, `skillDetailsItemSkills`, `skillGrants`; `skillGrantsUndescribed` must stay 0 (an item grants a
     skill without a skilldesc row = the page cannot show it). A warning `skilldetails: unknown skill in oskill "X" (Item)`
     is genuine ESR data (today: "Axe Swarm" on Ember of Creation); a new one means the item references a skill that
     does not exist in skills.txt, report it.
   - `tiers.json`: `counts.tierCodes` (1067 at 3.2.24) moves only when weapons.txt / armor.txt rows are added or removed;
     a change in `tierCodesMythical` (61) means new Mythical bases. The integrity test pins the total.
   - `icons.json` + `icons/`: `itemIcons` / `uniqueIcons` / `setIcons` / `miscIcons` / `tintedIcons` grow with the new
     items; `vanillaIcons` can only grow when the vanilla art folder is present. New files under `public/game-data/icons/`
     are expected; list any new unique/set/base that got no icon (`generate-item-icons.ts` prints "no art" lines) so the
     owner can ask the mod author for the missing art. `skillIcons` = the icon keys of skilldetails.json (325 at 3.2.24).
     Then the bundles added or extended in v1.35.0–v1.41.0:
   - `lootfilter.json`: its ids are **row numbers** — `uniques` / `sets` ids are uniqueitems.txt / setitems.txt rows
     (one id space, 1390 / 270 at 3.2.24), `stats` ids are itemstatcost rows (926), `areas` ids are levels.txt ids
     (215) — and every player's filter plus the bundled template stores them. A row inserted mid-table shifts every id
     after it silently. Compare the id → name maps with the committed bundle and report any shift as a finding (the
     affected rules in players' filters start matching other items):
     `node -e "const {execSync}=require('child_process');const o=JSON.parse(execSync('git show HEAD:public/game-data/lootfilter.json'));const n=require('./public/game-data/lootfilter.json');for(const k of ['uniques','sets','stats','areas']){const m=new Map(o[k].map(e=>[e.id,e.name]));for(const e of n[k])if(m.has(e.id)&&m.get(e.id)!==e.name)console.log(k,e.id,JSON.stringify(m.get(e.id)),'->',JSON.stringify(e.name));console.log(k,o[k].length,'->',n[k].length)}"`
     The integrity test also pins the `drops` flag (`r48` "Hu Rune" is the only spawnable item that never drops: no
     gems.txt row), `reqLvl > 0` on every unique and set row, and the `disabled` uniques (ids 0 The Perfect Cello and
     690–695 the Rupture charms; no disabled set item). A release that re-enables or disables rows, or adds a rune
     row, fails the test: explain it with the table diff and update the pins.
   - `affixes.json`: `counts.affixes*` as before; the `stats` list (148 stats at 3.2.24) and per-affix `stats` feed the
     loot-filter affix browser, so the "affix stats: property … is not mapped" warning means a new properties.txt func
     the mapper does not know — report it as a follow-up (`build/affixStats.ts`).
   - `cube.json`: `counts.cubeFamilies` (62), `cubeRawRecipes` (441), `cubeFallbackFamilies` (9) and `cubeFallbackRows`
     (41). Fallback families (`other:` ids) collect the rows no family regex matched: when they grow, a cubemain
     `description` changed its shape, the same finding as step 6 below (the regexes live in
     `src/features/game-data/build/cube/cubeFamilies.ts`). `cubeHidden*` move with the enhance / trap / stocker rows.
     The page shows every stat condition with a known `op` (3, 15, 16, 17, 18 as ESR uses them) and skips unknown ops
     silently: list the `op` values of added cubemain rows (`cut -f` on the table diff) and report a new one.
   - `areas.json` (v1.35.0, levels.txt): `counts.areas` (197), `areasMaps` (57), `areasMapZones` (20),
     `areasUniqueMaps` (1), `areasHiddenPrepZones` (17), `areasUniquesMinsThenMaxes` (61: older rows whose unique-pack
     columns are read mins then maxes). Warnings `areas: … is tier N but its LevelGroup says tier M`, `… unique packs
have min > max read pairwise and mins then maxes` and `… VisN names unknown level` are new row data to explain.
     The integrity test pins the five map tiers at 4 zones each on the 100 / 102 / 104 / 106 / 108 ladder, The Hidden
     Vault as the only unique map, the five town names (waypoint, no level) and Blood Moor as id 2: a new tier, zone
     or unique map fails it, and the patch notes should say why.
4. The app reads the docs-data version live from `d2rloader/metadata.json` (`metadata.modVersion`, raw GitHub) and
   compares it with the manifest's `esrVersion`: check that the clone's `d2rloader/metadata.json` says the new version.
   If the author forgot to bump it, every user will see "Docs data is ESR <old>; game-file data is ESR <new>" in amber
   until it is fixed upstream; report it as a finding (the owner can ask the author). Also
   `curl -sI https://easternsunresurrected.com/runewords.htm | grep -i last-modified` must be on or after the release
   day; if the docs site was not regenerated, the HTM-based pages (runewords, uniques, socketables, gemwords,
   ascendancies) lag the game files and the report must say so.
5. Explain every count change with the release diff (e.g. "+2 runewords: patch note adds X and Y", "+14 affixes:
   magicsuffix.txt rows added"). Anything you cannot explain → investigate (table diff, generator warnings) before
   moving on, and report it.
6. Check the generated recipe blocks that rewrite rows generically; they fall back to raw rows instead of failing
   when the cubemain shape changes. List every `::recipes` block with its row count:
   `node -e "const g=require('./public/guide/guide.json');const w=b=>Array.isArray(b)?b.flatMap(w):b&&typeof b==='object'?[b,...Object.values(b).flatMap(w)]:[];for(const n of g.notes)for(const b of w(n.body))if(b.kind==='recipes')console.log(n.slug,'|',b.caption,'|',b.rows.length)"`
   and compare with `git show HEAD:public/guide/guide.json` through the same command. Expected shapes: `rune-conversion`
   (rune-families) has one "Ancient Decal (X -> Y) + X Rune → Y Rune" row and one "An LoD rune … → The ES rune and the
   Ancient Decal" row; per-Decal rows instead mean a Decal name no longer matches its row. `rune-forging` (forging)
   has 3 rows whose rune ranges are read from the rows. `legendary-consumables` (enhancement-order) shows the Halo as
   "The same item + A copy of the item (Branded)". A block that grew to the 12-row cap or lost its generic rows is a
   finding to report, not to hide.
7. Three things the app links or bundles are not in the clone, so the diff cannot see them move (all warning-only
   when offline):
   - The Drop Finder (`https://easternsunresurrected.com/drop-finder.html`, linked under every `::source` block and by
     `dropfinder:` links) and the Frame Table (`https://easternsunresurrected.com/ias-calculator.html`, the header's
     official links; not linked from the site's own navigation, so it can vanish unnoticed):
     `curl -sS -o /dev/null -w '%{http_code}\n' <url>` must print 200 for both.
   - Sully's QoL filter, the loot-filter template (`public/loot-filters/sullys-qol-filter.json`, the file the ESR
     launcher pulls live from github.com/Thisisnotsully/QoL-Filter since 3.2.22). Diff the bundled copy with upstream:
     `curl -sS https://raw.githubusercontent.com/Thisisnotsully/QoL-Filter/main/Sullys-QoL-Filter.json | diff - public/loot-filters/sullys-qol-filter.json`.
     A newer upstream version is a follow-up ("refresh the template to vX"; the copy is verbatim, `TEMPLATE_CREDIT` in
     `src/features/loot-filter/utils/template.ts` names the version, `docs/features/LOOT-FILTER.md` describes it; its
     sounds and icons must stay bundled, `referencedAssets.test.ts`). Then check that the bundled copy still matches
     the regenerated data: `validate.test.ts` runs without the game-data reference, so build one and validate:
     `node --experimental-strip-types -e "import('./src/features/loot-filter/engine/reference.ts').then(async r=>{const v=await import('./src/features/loot-filter/engine/validate.ts');const p=await import('./src/features/loot-filter/engine/parse.ts');const fs=require('fs');const ref=r.buildLootFilterReference(JSON.parse(fs.readFileSync('public/game-data/lootfilter.json','utf8')),JSON.parse(fs.readFileSync('public/game-data/types.json','utf8')));console.log(v.validateLootFilter(p.parseLootFilter(fs.readFileSync('public/loot-filters/sullys-qol-filter.json','utf8')).filter,ref))})"`
     must print `[]`; a diagnostic names a rule whose code, id or stat the new data no longer has (or, after an id
     shift, now means another item) — report it, do not edit the copy.

## 4. Guide

1. Read `npm run guide:report` (draft / fresh / review / old, stale reasons, `volatility: high` notes).
2. For each `review` or `old` note: read its stale reasons and the note (`content/guide/notes/<slug>.md`).
3. For each patch-note item, find the notes and glossary terms it touches:
   `grep -rn -i '<term>' content/guide` (notes, `_glossary.yml`, `spine.yml`, `_sources.yml`).
4. Draft concrete edits (do not apply yet unless they fix a build error): text changes, new or changed glossary terms
   in `_glossary.yml`, a new `kind: link` stub when a new system appeared (draft: no `verified:`). Rules:
   - keep a note body ≤ ~250 words (the build warns above 400);
   - a new stub's slug must not be a reserved route slug (`RESERVED_SLUGS` in `src/features/guide/build/parseNote.ts`:
     `map`); the build rejects it;
   - prose that tells the player to farm or find an item may carry one `[label](<dropfinder:Item Name>)` link per
     paragraph (the name is validated against `sources.json`, the link always opens the plain Drop Finder page);
   - never type a number a directive can provide (`::recipes`, `::source`, `::vendor`, `::secret-recipes`,
     `::difficulty-penalties`, `::card`, …); link to the data instead;
   - leave `verified:` and `content/guide/.verify-lock.json` untouched — only the owner verifies in-game;
   - every fact must come from the release diff, the game files or an existing source; no invention.
5. Build errors from step 1 (renamed or removed items, dead directive arguments, unknown `::recipes` family, dead
   `docs:` anchors) must be fixed in `content/guide`, never by loosening the generator. Show the owner each fix.
6. After any content edit: `npm run guide:generate` and `npm run guide:check`; both must pass. Run
   `npx prettier --write` on the touched content files.

## 5. Ask the owner

One `AskUserQuestion` call, at most 4 questions:

1. **Data update**: "Accept ESR <old> → <new>?" with the count deltas and any warnings in the question text.
2. **Note edits** (multi-select): one option per proposed edit ("<slug>: <one-line change>", "glossary: add <term>",
   "new stub: <slug>"). Skip if there are none.
3. **Commit**: "Commit now" vs "Leave uncommitted". Commits:
   - `chore(game-data): update to ESR <version>` with `public/game-data` (includes the manifest) and `public/guide`
     when only regenerated data changed there (test fixtures are gitignored);
   - `docs(guide): <what changed> for ESR <version>` with `content/guide` + `public/guide` when notes changed.
4. **Follow-ups** (multi-select): e.g. "new system X has no note yet", "note Y needs a rewrite", "unexplained count
   change Z". Skip if none.

Apply the chosen edits, re-run `guide:generate` + `guide:check`, then commit only if question 3 said so. Follow the repo's
commit attribution rules; pre-commit hooks run Prettier/ESLint. Never push.

## 6. Final report

- ESR version/tag/commit before → after.
- What changed for players (the step 2 summary, short).
- What changed in the bundles: files, count deltas with their explanation, warnings; new or missing item icons, new or
  renamed skills, whether `d2rloader/metadata.json` and the docs site are at the new version, whether the vanilla art
  folder was available.
- Guide: notes edited, build errors fixed, glossary/stub additions.
- Still needing in-game verification by the owner: the `draft`, `review` and `old` lists from a fresh
  `npm run guide:report`, plus `volatility: high` notes. The owner runs `npm run guide:verify -- <slug>` after checking.
- Committed or not (hashes), and everything deferred or unexplained.

## When things go wrong

- **ESR clone dirty / on another branch**: the update aborts. Show `git -C <clone> status`; ask before cleaning or
  checking out `main`. Never reset the clone without approval. Untracked `.DS_Store` files (Finder) are ignored by the
  update (change after v1.33.0); `generate-game-data.ts` still prints its "uncommitted changes" warning for them, which is harmless.
- **Tag not found**: confirm the tag name with the owner (`git ls-remote --tags <ESR remote>`; no `v` prefix); fall back
  to `main` only if they agree.
- **Release diff shows nothing / missing files**: the manifest commit may be absent from a shallow clone or a path may
  be outside the sparse checkout; report it and ask (deepen the fetch or `sparse-checkout add`), do not guess.
- **New generation warnings** (string conflicts, duplicate bases, unresolved stats): find the rows in the table diff,
  explain them; if they look like a parser gap, report it as a follow-up instead of patching code silently.
- **Integrity test fails** (`src/features/game-data/bundleIntegrity.test.ts` expects fixed counts such as 369 weapons /
  255 armors, 1067 tier codes, spot codes like `p01` normal / `m01` mythical, and compares the committed
  `skilldetails.json`, `tiers.json` and icon indexes with a fresh build from the clone): if the release diff explains the
  new count, propose updating the expected numbers (and the counts in the docs: `grep -rln '3\.2\.<old>' docs` lists
  the pages that quote the old version's numbers — `GAME-DATA.md`, `LOOT-FILTER.md`, `SKILLS.md`, `UNIQUE-ITEMS.md`,
  `CORE-DATA.md`, `technical/DATA-MODELS.md`, `technical/NAVIGATION.md` at 3.2.24); otherwise investigate. Besides the counts, the test pins loot-filter rows (`r48` never drops,
  disabled unique ids 0 and 690–695), the areas shape (4 zones per tier, the 100–108 ladder, The Hidden Vault, the
  five towns) and the cube family list (every family keeps at least one row): see step 3.3 for what each means. A mismatch between committed and regenerated skill icons or item icons
  means a generator was not rerun: `npm run game-data:icons` (needs the vanilla art folder) and
  `npm run game-data:skill-icons`.
- **Other game-data tests fail** (name oracle, runeword matching): compare with the HTM fixtures; a renamed item in the
  docs vs the tables is a data mismatch to report, not to hide.
- **`game-data --check` / `guide:check` fails**: output is non-deterministic or stale; re-run the generator once and
  report if it persists.
- **Guide build errors**: unknown `rw:`/`unique:`/`socketable:`/`base:`/`dropfinder:` target or `::source` name → use
  the new name from the strings diff (add `{item=…}` when it became ambiguous); unknown `::recipes` family or a family
  that matches no row → the cubemain `description` changed, report it (the family list and its regexes live in
  `src/features/guide/build/cubeFamilies.ts`); dead `docs:` anchor → find the new anchor in the changed docs page;
  unknown `:term` → add the term to `_glossary.yml` or fix the spelling; reserved slug → rename the new note.

## Do not

- Run `npm run guide:verify` or edit `verified:` / `.verify-lock.json`.
- Commit or push without the owner's approval; never push at all.
- Type numbers into notes that a directive or data link can provide.
- Edit `public/game-data/*.json` or `public/guide/*.json` by hand; only the generators write them.
- Invent facts. If a patch note is ambiguous, say so and ask.
- Change generator or app code as part of this procedure without asking; propose it as a follow-up.
