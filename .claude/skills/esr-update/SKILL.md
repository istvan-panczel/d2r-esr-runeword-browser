---
name: esr-update
description: Update the app to a new Eastern Sun Resurrected (ESR) release end to end — regenerate every bundle, run the full test suite, read the release diff, review every feature's data with esr:review and parallel review agents, scan players' saved data, apply guide/doc/template edits, ask the owner once, commit. Also proposes updates to this skill when the repo has new features it does not cover. Use when the owner says "ESR released a new version", "update the game data", "bump ESR", "new ESR patch" or runs /esr-update.
---

# ESR release update

You update the app to a new ESR release, review every change, and ask the owner at the decision points. Argument: an
optional ESR tag (`/esr-update 3.2.25`; tags have no `v` prefix). Work from the repo root. The ESR clone is
`../Eastern_Sun_Resurrected` unless `ESR_SOURCE_DIR` / `--esr <dir>` says otherwise. **Read
[reference.md](./reference.md) before step 4**: it explains every review check, the agent briefs, the guide rules, the
commit plan and what to do when something goes wrong.

Scratch folder `$S`: the session scratchpad if one is listed, else `$TMPDIR/esr-update`. All reports go there, never
into the repo.

## 0. Preflight

1. `git status --porcelain` must be empty; otherwise stop and ask (stash, commit or abort). Never discard anything.
2. Old version: `esrVersion`, `esrTag`, `esrCommit` from `public/game-data/manifest.json`.
3. New version: the requested tag, else the newest tag of the ESR remote
   (`git -C <clone> ls-remote --tags origin`, highest version). **Require a tag**: if `main` has commits after the
   newest tag, say so and update to the tag; use `main` only when the owner explicitly asks for it.
4. Same version as the manifest → say so and ask whether to continue (e.g. to pick up a re-tag); otherwise stop.
5. On `master`: create and switch to `chore/esr-<new version>`.

## 1. Regenerate and test

`npm run game-data:update -- --tag <tag> 2>&1 | tee "$S/update.log"` (several minutes). It pulls the clone, keeps the
previous HTM fixtures in `test-fixtures/previous/`, generates every bundle (and with them the loot filter agent pack,
`public/loot-filters/agent/`), the item and skill icons, the guide and the sitemap, refreshes the fixtures, runs
`game-data --check` (it covers the pack), `guide:check` and the **full** test suite, and prints a summary. It never
commits.

- Generation itself failed (clone, manifest, generator crash) → stop, show the step, diagnose with reference.md
  "When things go wrong", ask before changing anything.
- Checks or tests failed → do not stop: continue read-only through steps 2–4; the review usually explains them
  (count pins in `bundleIntegrity.test.ts` fail on most releases). Fix only in step 5.
- The summary's note says icons.json kept the old version (vanilla art folder missing) → stop and ask the owner to run
  `npm run game-data:icons` on the machine with `../d2r-vanilla-art`, or to point `--vanilla` at it.

## 2. Release diff

`npm run esr:diff -- --from <old esrCommit> --to <tag> --out "$S/diff.txt"` and the same with `--json --out
"$S/diff.json"`. Read all of it: the launcher-versions line, patch notes (the primary source), tables (marked "read by
the app"), strings, docs pages, launcher configs, loot filters, everything else. Write `$S/summary.md`: new systems /
items / recipes, removed things, renamed things (old → new), balance changes the app shows. Say where a patch note is
ambiguous or contradicts the tables; never resolve it by guessing.

## 3. Review and user-data scan

1. `npm run esr:review -- --out "$S/review.md"` (writes `review.json` too; `--offline` skips the network checks).
2. `npm run esr:user-data -- --review "$S/review.json" --out "$S/user-data.txt"`: read-only GET scan of PROD's public
   builds, favourites and shared loot filters against the new data (needs network; shows counts and public names only).
3. **Stop and ask now** if `versions.mod-version` is a finding (the tag and `d2rloader/metadata.json` disagree: the
   data would get the old version label). Options: wait for upstream, or continue knowing the label is wrong.

## 4. Parallel review agents

Start the three review agents from reference.md ("Review agents") **in one message**, model Opus, read-only, each
with its brief and the `$S` paths. While they run, do nothing that writes to the repo. Merge their findings with
`review.md` into `$S/findings.md`: every finding with its evidence and the proposed action.

## 5. Apply the edits in the working tree

Apply what the findings call for; reference.md says how for each kind. Do not commit yet.

1. Guide note edits proposed by the guide agent (and any guide build errors); glossary and new draft stubs.
2. Integrity-test pins and other pinned numbers, only where the release diff explains the change.
3. Docs quoting the old version (`docs.old-version`): update the version and every count you can derive from the new
   manifest or bundles; list the ones you cannot.
4. Sully's template, when upstream differs (`lootfilter.template` / `lootfilter.assets`): run
   `npm run loot-filter:template` and bundle any new icon or sound it reports (icons shrunk to 128 px); the app loads
   his live file anyway, the copy is the fallback. The validation must not gain diagnostics.
5. Official links (`net.links`, `net.docs-site`): fix moved or dead official URLs in `navConfig.ts`,
   `guideHome.ts` and the guide's `docs:` links. Community tools are out of scope: only report them.
6. Campaign map (`src/features/campaign-map/campaignMapIntegrity.test.ts` failures, or new/renamed/removed areas in
   the release diff): place new areas in the act grids (`data/grids.ts`), update `data/names.ts`, curated links and facts
   (`data/links.ts`, `data/areas.ts`) and the official Maps page notes; see docs/features/CAMPAIGN-MAP.md. Also check
   the areas build warnings (`REMOVED_LEVELS`, `EXPECTED_ONE_WAY_VIS`, unknown LevelType, missing comment columns).
   Map bosses: a new or renamed boss fails the integrity test (`data/mapBosses.ts`, keyed by monstats Id); when
   `docs/endgame_maps.htm` changes, re-read it and update the fight notes and the `page` figures there (the panel and
   `content/guide/notes/endgame-bosses.md` compare them with the files' rewards in areas.json `mapBosses`).
7. Ascendancy orb table (`src/features/ascendancies/data/orbLocations.ts`, hand-maintained, checked in game): when
   `orbLocations.test.ts` fails or the release diff touches the orbs (misc.txt u11–u15), their superuniques or those
   areas, propose the fix and ask the owner to re-check the spots in game; keep `content/guide/notes/ascendancies.md` in step.
8. Hand-kept data (`refs.followed`, `mapbosses.page`, new `masteries:` / `areas:` / `crafting:` warnings): official
   pages and launcher configs the app keeps hand-written copies of (map boss page figures and fight notes, weapon
   mastery group rules, cube section notes, modifier prose) changed, or the files moved away from them. Edit the data
   files and `content/`; propose generator constants (`GROUP_RULES`, `HIDDEN_MOD_LABELS`, `CUBE_SECTIONS`,
   `FAMILY_NOTES`, `NAME_ALIASES`, `NAME_OVERRIDES`). Upstream data bugs and page-vs-files differences become questions
   for the mod author (reference.md "Hand-kept data").
9. Do **not** apply without asking: a `LOOT_FILTER_PLUGIN_VERSION` bump, generator or app code changes, skill edits.

Then `npx prettier --write` on the touched files, `npm run guide:generate`, `npm run guide:check` and `npm run test`;
all must pass.

## 6. Ask the owner

First print the numbered list of applied edits (from `$S/findings.md`) and the short summary. Then **one**
`AskUserQuestion` call, at most 4 questions, skipping any that do not apply:

1. **Data update**: "Accept ESR <old> → <new> and commit?" (count deltas, new warnings, user-data impact in the
   question): commit / leave uncommitted / reject (revert the working tree only after a second confirmation).
2. **Applied edits**: keep all / keep none / Other: the numbers to drop.
3. **Loot filter**: the plugin version bump (and what to re-verify in game), when the plugin changed.
4. **Skill update and follow-ups** (multi-select): the proposals from step 8 and the unresolved findings (generator
   constants from step 5.8 included).

## 7. Commit (only if question 1 said so)

Follow reference.md "Commits": `chore(game-data): update to ESR <version>` first, then `docs(guide): …`, then one
commit per other topic. Pre-commit hooks run the staged-file guard, Prettier/ESLint, the exiftool check and gitleaks;
a hook failure is a finding to fix, never a reason for `--no-verify`. Never push, never release.

## 8. Skill self-update

From `self.coverage` (bundles, count keys or warning classes esr:review does not know) and `self.commits` (feature
commits since this skill or the review script last changed): read the commits and decide whether they add ESR-dependent
data, pages or saved user data this procedure does not cover. Propose concrete edits to `SKILL.md`, `reference.md` or
the review scripts (question 4 above): a new bundle section → `BUNDLE_SPECS` (`scripts/lib/esrReview/bundles.ts`), a
new count or warning class → `KNOWN_COUNT_PREFIXES` / `KNOWN_WARNING_CLASSES` (`selfCheck.ts`) with an explanation in
reference.md, an official page or launcher config a feature follows → `ESR_REFERENCES` (`scripts/lib/esrReferences.ts`).
Apply only after approval, as a separate `chore(esr-update): …` commit.

## 9. Patch-note check (PDF)

The shareable answer to "does the ESR changelog match the actual changes?". Do this whether or not question 1 said to
commit; follow reference.md "Patch-note check".

1. `npm run esr:changelog -- --init --diff "$S/diff.json" --out "$S/changelog-check.json"` (one `pending` entry per
   patch-note line).
2. Fill it from the release diff and the data review: a verdict and evidence for every line, the changes no patch note
   mentions, the official pages behind the files, what could not be checked.
3. `npm run esr:changelog -- --in "$S/changelog-check.json" --diff "$S/diff.json" --out owner-notes/esr-<new>-changelog-check.pdf`
   (refuses a file with a line left out; also writes the `.html`). `owner-notes/` is gitignored. Look at the result
   before reporting it.
4. Publish it on the Patch Notes page: `npm run patch-notes:generate` copies `owner-notes/esr-<new>-changelog-check.*`
   (and an `ESR-<new>-unique-runeword-changes.html/.pdf` item report, when one was made) to `public/patch-notes/reports/`
   and lists them under `/patch-notes/<new>` (docs/features/PATCH-NOTES.md). Read the HTML for anything that should not
   be public (personal names, questions for the mod author) first; commit `public/patch-notes/` with the update when
   question 1 said to commit, else leave it uncommitted and say so.

## 10. Final report

ESR old → new; what changed for players; bundles (count deltas with their explanations, warnings, icons, renamed
skills or ids, variant shifts, user-data impact); guide and doc edits; template, links and plugin; whether the vanilla
art folder, `metadata.json` and the docs site were at the new version; commits (hashes) or "uncommitted"; everything
deferred. Next steps for the owner: merge into `master`, `npm run release`, `git push --follow-tags`, then the Deploy
workflow. Deploy soon: until then players see the old data, new item codes fail stash uploads, and the loot filter
editor flags new codes as unknown. Questions for the mod author: new ones ready to paste and the ones in the owner's
latest `owner-notes/owner-checks-*.md` (gitignored) this release answers. The PDF's full path and its verdict counts
(lines that are partly true, differ or are not found). Guide notes still needing in-game checks: the `draft` / `review` /
`old` lists of `npm run guide:report`; the owner runs `npm run guide:verify -- <slug>` after checking.

## Do not

- Edit `public/game-data/**` or `public/guide/**` by hand; only the generators write them.
- Run `npm run guide:verify` or touch `verified:` / `content/guide/.verify-lock.json`.
- Invent facts; type numbers into notes that a directive or data link can provide.
- Change generator or app code, or this skill, without asking.
- Commit without the owner's approval; push or release at all.
