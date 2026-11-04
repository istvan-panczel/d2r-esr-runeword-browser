# Feature: Game Data (from the ESR txt game files)

## Overview

Add a new "Game Data" section built from the ESR mod's raw game tables (the tab-separated `data/global/excel/*.txt` files
published in the open-source repo `CelestialRayOne/Eastern_Sun_Resurrected`). Unlike the existing HTM pipeline, this data is
converted **at build time** by a Node script into compact JSON bundles committed under `public/game-data/`, pinned to an ESR
git tag. The browser never parses txt files and never touches Dexie for this data.

Pages (all under one nav entry, "Game Data", with sub-tabs):

| Route                  | Tab        | Purpose                                                                                                          |
| ---------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------- |
| `/game-data`           | —          | redirects to `bases`                                                                                             |
| `/game-data/bases`     | Bases      | Browse spawnable base items (weapons, armor, equippable accessories) with tier, stats, requirements, socket caps |
| `/game-data/best-base` | Best Base  | Pick a runeword + character (class, level, str, dex) → ranked eligible bases                                     |
| `/game-data/affixes`   | Affixes    | Browse magic prefixes/suffixes/automods; "what can roll" on a base at an item level                              |
| `/game-data/types`     | Item Types | Item type hierarchy (Equiv graph) + socket cap table                                                             |

Owner decisions (2026-10-09): build-time JSON; all four pages; real descfunc stat renderer (at build time); character
inputs are a local form persisted in localStorage (no builds/Supabase tie-in); uniques/sets/gemwords/runeword lists stay on
the HTM pipeline.

## Source data

Local clone (sibling folder): `../Eastern_Sun_Resurrected`. Relevant paths inside it:

- `Eastern_Sun_Resurrected.mpq/data/global/excel/*.txt` — ignore the byte-identical `excel/base/` duplicate folder
- `Eastern_Sun_Resurrected.mpq/data/local/lng/strings/*.json` — array of `{id, Key, enUS, ...}`; inconsistent UTF-8 BOM;
  one global key space across files (100 duplicate keys, 85 with differing enUS text); strip `ÿc.` colour codes
- `d2rloader/metadata.json` → `metadata.modVersion` is the mod version (`modinfo.json` is stale, never use it)
- version pin = git tag of the clone HEAD (`git describe --tags --exact-match`), tags have no `v` prefix (e.g. `3.2.10`)

Refreshing the clone: `git -C ../Eastern_Sun_Resurrected pull`. A fresh checkout only needs
`git clone --depth 1 --filter=blob:none --sparse` plus `git sparse-checkout set Eastern_Sun_Resurrected.mpq/data/global/excel Eastern_Sun_Resurrected.mpq/data/local/lng/strings d2rloader/metadata.json`.
No remote download mode in the script: the clone is the only source.

Established facts (verified during exploration):

- 52 txt files, pure ASCII, LF, TAB, every row has the header's column count. `Expansion` marker rows (first cell
  `Expansion`, rest empty) appear in weapons/armor/misc/itemtypes/gems/properties/charstats. Comment columns start with `*`.
  Blank numeric cell means 0. Accept CRLF too.
- Player-facing base filter: `spawnable == 1` and `quest` blank/0 → 369 weapons, 255 armors. ESR has hundreds of
  non-spawnable shadow bases used only by uniques, and 62 "Mythical" bases (`m01`–`m61`, `normcode == ubercode == ultracode == code`).
- Tier = position of `code` in `normcode` / `ubercode` / `ultracode`; mythical when all three equal `code`.
- ESR uses `type2` (`1hsw` / `2hsw`) on weapons and runewords target `2hsw` → type matching walks `Equiv1`/`Equiv2` of BOTH `type` and `type2`.
- Max sockets = `min(gemsockets, MaxSockets1|2|3)` where the band is `ilvl ≤ MaxSocketsLevelThreshold1 (25)` /
  `≤ MaxSocketsLevelThreshold2 (40)` / else, using the base's OWN `type` row only (not Equiv parents).
- itemtypes quirk: code `merc` is labelled "Helm" and has no Equiv; the real `helm` row is last. 5-char codes `casce`,
  `cosce`, `csta` have no parents and no bases.
- itemtypes has `Class` (ama sor nec pal bar dru ass war), `UICategory`, `RunewordCategory1/2`, `Restricted`.
- Affix files (magicprefix 909, magicsuffix 1591, automagic 143 rows; identical 39 columns). Affix `Name` is English text
  that is also the string key. Hide internal stat `tinkerflag2`. Affix `modNcode` references `properties.txt` only.
- runes.txt: 449 `Runeword*` keys (434 rune-based, 15 gem-only); 301 distinct display names (e.g. "Rain" ×5). Socket
  ranges = one row per socket count with `jew` / `mjw` prepended. `*Rune Name` comment column is unreliable; resolve
  `Name` through strings. "Ko Rune" exists as both `r19` and `r68` → match recipes by display name.
- Runeword/gemword `T1Code` may reference `propertygroups.txt` (random pools: `PickMode`, `Prop1-8`, `ParMin/Max`,
  `ModMin/Max`, `Chance`).
- Strings are mostly printf formats (`%+d to Strength`, `%+d to %s %s`, positional `%0`/`%1`); a few are bare labels.
- descfunc values in use: 1, 2, 3, 5, 11, 12, 13, 14, 15, 16, 19, 20, 22, 23, 24, 27, 28; only `dgrpfunc` 19 is used.
  properties `func` values in use: 1, 2, 3, 5, 6, 7, 8, 10–25, 36.
- `+skill` params are skill NAMES; `skilltab` params 0–23 (Warlock 21–23). 8 classes incl. Warlock (charstats.txt).
- HTM docs version (changelog) is `3.2.02` while the repo tag is `3.2.10`: the two version strings will differ in the UI.

## Cross-cutting decisions

### Running TypeScript scripts

Use Node's built-in type stripping (default since Node 22.18). Bump `engines` to `>=22.18 <23`. All tsconfigs already set
`erasableSyntaxOnly`, `verbatimModuleSyntax`, `allowImportingTsExtensions`. Constraints for code shared with the script:
relative imports ending in `.ts`, no `@/` aliases, no DOM or React.

Add `tsconfig.scripts.json` (includes `scripts/**/*.ts` and `src/features/game-data/{engine,build}/**`, `types: ["node"]`,
`lib: ["ES2023"]`, no DOM), reference it from `tsconfig.json`, add it to ESLint `parserOptions.project`, and add a
`files: ['scripts/**/*.ts']` block with `globals.node`. Fallback if type stripping misbehaves: add `tsx` as a devDependency
and change only the npm script.

### Code layout

```
scripts/generate-game-data.ts                 thin CLI; all filesystem/git I/O lives here
src/features/game-data/
  engine/      pure logic used at runtime AND build time: schema types, type ancestors, socket caps, eligibility, ranking,
               alvl, runeword matching, bundle loader
  build/       build-only: tsv parser, strings loader, model, stat renderer (build/stats/), bundle writers
  components/ hooks/ screens/ store/ utils/ constants/   normal feature layout (Phase 1+)
public/game-data/{manifest,types,bases,runewords,affixes}.json   committed output
```

### Bundle layout and loading

One JSON per area, loaded lazily by the pages that need it. Arrays are written one element per line (readable diffs).
Stable key order. The manifest holds a sha256 per file for cache-busting.

| File             | Contents                                                                                  | Est. raw / gzip |
| ---------------- | ----------------------------------------------------------------------------------------- | --------------- |
| `manifest.json`  | schema, esrVersion, esrTag, esrCommit, generatedAt, per-file hash+bytes, counts, warnings | ~1 KB           |
| `types.json`     | item types + classes                                                                      | ~25 KB / 4 KB   |
| `bases.json`     | 624 weapons/armor + ~15 accessories                                                       | ~180 KB / 20 KB |
| `runewords.json` | txt runeword rows                                                                         | ~80 KB / 10 KB  |
| `affixes.json`   | 2,643 affixes with rendered text                                                          | ~550 KB / 40 KB |

Loader: `fetch(\`${import.meta.env.BASE_URL}game-data/${file}.json?v=${hash}\`)`with a module-level cached Promise per
file; manifest fetched with`cache: 'no-cache'`; a failed request clears its cache entry so Retry works. Hook
`useGameData(files)`returns`{ status, data, error }`. Loading shows the route Spinner; errors show a Card with Retry. If
`manifest.schema !== GAME_DATA_SCHEMA`, show "Game data out of date, reload". Not a Vite JSON import (huge literal types).

### Redux

One `gameData` slice registered statically in `store.ts`, no saga. Holds only per-page filters and `character`. Parsed
bundles stay out of Redux. `character` is restored via `readPersistentJson` + validator and written in its reducer with
`writePersistentJson('gameData.character')`, mirroring `settingsSlice`.

### Navigation, URLs, version banner

- One `INTERNAL_PAGES` entry `{ key: 'game-data', to: '/game-data', label: 'Game Data', end: false }`; `GameDataLayout`
  (lazy) renders sub-tabs + `<Outlet>`. Add `'@/features/game-data'` to `routeCodeSplitting.test.ts`; add routes to `public/sitemap.xml`.
- URL params follow `useUrlInitialize` / `useShareUrl`. Reuse `FILTER_URL_PARAM_KEYS.SEARCH`, `SOCKETS`, `ITEMS`; new keys
  in `features/game-data/constants/urlParams.ts`: `kind`, `tier`, `rw`, `v`, `cls`, `lvl`, `str`, `dex`, `base`, `ilvl`, `aff`, `rare`, `type`.
- `GameDataLayout` always shows "Game files: ESR 3.2.10 (tag 3.2.10 @ 10b540e, generated YYYY-MM-DD)". When the manifest
  version differs from Dexie `metadata.esrVersion`, show an amber note that the docs data and game-file data differ. Never
  claim which is newer (HTM versions like "3.12" / "3.9.09" do not compare numerically with "3.2.10").

## Schema (`src/features/game-data/engine/schema.ts`)

```ts
export const GAME_DATA_SCHEMA = 1;
type ClassCode = 'ama' | 'sor' | 'nec' | 'pal' | 'bar' | 'dru' | 'ass' | 'war';
type GameDataFile = 'types' | 'bases' | 'runewords' | 'affixes';

interface GameDataManifest {
  schema: number;
  esrVersion: string;
  esrTag: string | null;
  esrCommit: string;
  generatedAt: string;
  files: Partial<Record<GameDataFile, { hash: string; bytes: number }>>;
  counts: Record<string, number>;
  warnings: string[];
}
interface TypesBundle {
  types: ItemTypeInfo[];
  classes: ClassInfo[];
}
interface ItemTypeInfo {
  code: string;
  name: string;
  parents: string[];
  ancestors: string[]; // ancestors includes self
  sockets: [number, number, number];
  thresholds: [number, number];
  cls: ClassCode | null;
  ui: string | null;
  rwCats: string[];
  magic: boolean;
  rare: boolean;
  normal: boolean;
  bodyLoc: string | null;
}
interface ClassInfo {
  code: ClassCode;
  name: string;
  tabs: [string, string, string];
}
interface BasesBundle {
  bases: BaseItem[];
}
interface BaseItem {
  code: string;
  name: string;
  kind: 'weapon' | 'armor' | 'misc';
  type: string;
  type2: string | null;
  ancestors: string[]; // union over type + type2
  tier: 'normal' | 'exceptional' | 'elite' | 'mythical';
  family: [string, string, string]; // norm/uber/ultra codes
  qlvl: number;
  reqLvl: number;
  reqStr: number;
  reqDex: number;
  gemSockets: number;
  socketCaps: [number, number, number]; // min(gemSockets, own-type MaxSockets1/2/3)
  dmg1: [number, number] | null;
  dmg2: [number, number] | null;
  throwDmg: [number, number] | null;
  speed: number;
  strBonus: number;
  dexBonus: number;
  def: [number, number] | null;
  block: number | null;
  durability: number;
  indestructible: boolean;
  magicLvl: number;
  autoGroup: number | null;
  cls: ClassCode | null;
  inv: [number, number];
}
// Phase 2
interface TxtRunewordsBundle {
  runewords: TxtRuneword[];
}
interface TxtRuneword {
  key: string;
  name: string;
  rows: TxtRunewordRow[];
} // key = 'Runeword871'
interface TxtRunewordRow {
  ingredients: string[];
  codes: string[];
  jewels: number; // ingredients = display names, jew/mjw removed and counted
  sockets: number;
  itypes: string[];
  etypes: string[];
  reqLvl: number; // reqLvl = max ingredient levelreq
}
// Phase 3
interface AffixesBundle {
  affixes: Affix[];
}
interface Affix {
  id: number;
  kind: 'p' | 's' | 'a';
  name: string;
  lvl: number;
  maxLvl: number;
  reqLvl: number;
  cls: ClassCode | null;
  clsReqLvl: number;
  freq: number;
  group: number;
  rare: boolean;
  itypes: string[];
  etypes: string[];
  mods: AffixMod[];
  text: string[];
}
interface AffixMod {
  prop: string;
  param: string | null;
  min: number;
  max: number;
}
```

## Algorithms

- **Type ancestors**: BFS over `Equiv1`/`Equiv2` keyed by code, from both `type` and `type2`, visited set. Display names
  that collide (`merc`/"Helm") get the code appended. `cls` = first ancestor with `Class` set.
- **Tier**: see facts; a code in none of the family columns → warning, treated as normal.
- **Socket band**: band 0 if `ilvl ≤ t1`, 1 if `ilvl ≤ t2`, else 2. `minIlvlForSockets(base, n)` = lower bound of the
  first band whose cap ≥ n (1, t1+1, t2+1), or null.
- **Which bases**: weapons/armor with `spawnable == 1` and `quest` blank/0; misc only when ancestors include `ring`,
  `amul`, `char`, `jewl` or a quiver type (verify codes).
- **Strings duplicate policy**: fixed file priority (item-runes, item-nameaffixes, item-modifiers, item-names, skills, then
  the rest; first wins); every conflict recorded in `manifest.warnings`. Verified by comparing base names against the
  repo's `docs/weapons.htm` / `docs/armors.htm` (Phase 0 integrity test) and by the Phase 3 renderer oracle.
- **Runeword matching (browser, against Dexie)**: normalize names (strip colour codes, NFKD, unify apostrophes, lowercase,
  collapse whitespace); pass 1 exact (name, ordered ingredients); pass 2 same name + ingredient multiset; pass 3 unique
  name on both sides → match flagged "recipe differs"; rest unmatched both ways. Surface: amber notice on the page, manual
  picker (cmdk) for a txt runeword, collapsible "Data consistency" list. Integration test asserts ≥ 95 % matched.
- **Best base eligibility** (per txt row): ancestors ∩ itypes ≠ ∅ and ancestors ∩ etypes = ∅; `max(socketCaps) ≥ sockets`
  (report `minIlvlForSockets`); `base.cls` null or equals character class (or class "Any"); `reqLvl/Str/Dex` ≤ character
  (toggle "include bases I can't use yet" shows deficits); ethereal toggle (−10 str/dex, ×1.5 dmg/def, labelled estimate);
  banner when runeword `reqLvl` > character level.
- **Ranking**: weapons by average damage (2H when `2handed`, else 1H; both when `1or2handed`), then speed, then lower
  combined requirements; armor by max defense (shields also block); accessories by req level. Grouped by type, tier
  badge, "upgrade path" link to the next-tier family member.
- **Affix level** (vanilla formula, ESR override unknown): `ilvl = min(ilvl, 99)`; `if qlvl > ilvl: ilvl = qlvl`;
  `magicLvl > 0 ? alvl = ilvl + magicLvl : ilvl < 99 − ⌊qlvl/2⌋ ? alvl = ilvl − ⌊qlvl/2⌋ : alvl = 2·ilvl − 99`; clamp 1–99.
- **Affix eligibility**: `lvl ≤ alvl`; `maxLvl == 0 || alvl ≤ maxLvl`; itypes ∩ ancestors ≠ ∅ and etypes ∩ ancestors = ∅;
  `rare` when quality filter is Rare; base has no class, or `affix.cls` null or equals `base.cls`. Automagic pool =
  kind `a` with `group == base.autoGroup`. Show weight `freq / Σfreq` per kind; note one affix per `group`.
- **Stat renderer (build time, per property, not per packed stat)**: `{code, param, min, max}` → properties `func1-7` /
  `stat` / `val` → stat entries → descfunc table → merge damage pairs → collapse full `dgrp` sets (dgrpfunc 19) → sort by
  `descpriority` desc. Property funcs: 1/2 random min–max; 3 reuse previous value; 5/6/7 dmg-min/max/%; 8 speed; 10 skilltab
  (class = ⌊p/3⌋, tab = p % 3); 11 event skill; 12 random skill; 13 durability %; 14 sockets; 15 min only; 16 max only;
  17 per level; 18 by time; 19 charges; 20 indestructible; 21 class skills; 22 skill/oskill (param = skill name → skills →
  skilldesc `str name`); 23 ethereal; 24 aura; 25/36/unknown → fallback `code param min–max` + build warning.
  descfunc table (S1 = descstrpos/neg, S2 = descstr2, V value, descval places V: 0 none / 1 before / 2 after; printf
  strings use sprintf): 1 `+V S1`; 2 `V% S1`; 3 `V S1`; 4 `+V% S1`; 5 `V×100/128% S1`; 6 `+V S1 S2`; 7 `V% S1 S2`;
  8 `+V% S1 S2`; 9 `V S1 S2`; 10 `V×100/128% S1 S2`; 11 repair durability; 12 `+V S1` (V omitted when 1, unverified);
  13 `+V to [class] Skill Levels`; 14 `+V to [tab] Skills ([class] Only)`; 15 sprintf(S1, chance, level, skill);
  16 `Level L [skill] Aura When Equipped`; 17/18 by time; 19 sprintf(S1, V); 20 `−V% S1`; 21 `−V S1`; 22 `V% S1 [montype]`;
  23 `V% S1 [monster]`; 24 `Level L [skill] (C/M Charges)`; 27 `+V to [skill] ([class] Only)`; 28 `+V to [skill]`.
  Per-level stats (`op`) render as "+(p/8 per level) … (Based on Character Level)". Propertygroups: PickMode 1/2 → "One
  of:" / "Each:" + sub-lines with Chance % (semantics unverified). `sprintf` supports `%d %+d %s %%` and `%0 %1`; ranges
  render `+10-20`, negative ranges `-(10-20)`.

## Phases (each leaves lint + build green and is independently committable)

### Phase 0 — converter, shared model, manifest, tests (no UI)

`scripts/generate-game-data.ts` (`--esr <dir>` | `ESR_SOURCE_DIR` | default `../Eastern_Sun_Resurrected`; `--check`
regenerates in memory and exits 1 if committed files are stale; warns on dirty clone; `generatedAt` only changes when a
content hash changes). npm: `game-data:generate`, `game-data:check`. Build modules: `tsv.ts`, `strings.ts`, `model.ts`,
`bundleTypes.ts`, `bundleBases.ts`, `writeBundle.ts`. Engine: `schema.ts`, `itemTypes.ts`, `sockets.ts`, `loadGameData.ts`.
Output: `public/game-data/{manifest,types,bases}.json`. Tests: `tsv`, `strings` (BOM, colour codes, duplicates),
`itemTypes` (chains, cycles, merc quirk, type2), `sockets` (band edges 25/26/40/41), `bundleIntegrity` (reads committed
JSON: 369 weapons / 255 armors, every type/ancestor exists, hashes match), clone-dependent tests use
`describe.skipIf(!existsSync(ESR_DIR))`.

### Phase 1 — Bases browser + Item Types page

Layout, slice, loader hook, banner, error card, `BasesScreen` (search over name/type/code; kind, tier, type tree, min
sockets, max req level, class-only; sort by name/qlvl/reqLvl/dmg/def/speed; row shows dmg 1H/2H/throw, def, block, reqs,
speed, socket caps per band, family N/X/E links, automod badge; "Show more" ×100 if needed), `ItemTypesScreen` (collapsible
Equiv tree, per-type details, flat socket-cap table, `?type=` focus). Tests: `filterBases`, `gameDataSlice`.

### Phase 2 — Best Base finder + character settings

`runewords.json` via `build/bundleRunewords.ts`; `engine/matchRunewords.ts`, `engine/bestBase.ts`; `BestBaseScreen` with
character form (class incl. "Any", level 1–99, str/dex 1–999; URL params override and persist); link from `RunewordCard`
("Best base" icon → `/game-data/best-base?rw=<name>&v=<variant>`). Tests: `bestBase`, `matchRunewords`,
`runewordMatching.integration` (skips without fixture).

### Phase 3 — Stat renderer + Affixes page + what-can-roll

`build/stats/{sprintf,expandProperty,descfunc,renderLines,propertyGroups}.ts`; `affixes.json`; `engine/affixEligibility.ts`;
`AffixesScreen` (search names + text; kind, rare-only, level range; base picker + ilvl slider → what-can-roll mode; grouped
by `group`; "Show more" ×200); "What can roll" link on each base row. Tests: `sprintf`, `descfunc` (one case per descfunc
in use), `expandProperty`, `dgrp`, `affixEligibility`, plus the renderer **oracle test**: render txt stats of matched
runewords and diff against HTM affix text, report identical-line % and assert a floor.

### Documentation (per phase)

New `docs/features/GAME-DATA.md`; update `docs/README.md` (second data system + routes), `ARCHITECTURE.md`,
`DATA-MODELS.md`, `NAVIGATION.md`, `TESTING.md`, `TECH-STACK.md`, and `CLAUDE.md` commands.

## Open assumptions (to confirm during implementation)

1. Duplicate string key policy (checked by Phase 0 name comparison + Phase 3 oracle).
2. descfunc 12, propertygroups PickMode, property funcs 2/24/25/36 semantics (vanilla memory).
3. Whether affix itype matching also walks `type2`, and whether `classspecific` applies only to class bases.
4. ESR may override the vanilla alvl formula or socket math via D2RLoader DLL plugins (no config found that does).
5. Level cap 99.
6. Which misc types count as equippable accessories.

## Phase 0 notes (deviations found while implementing)

- **Socket helpers take thresholds**: `BaseItem` has no thresholds, so `socketCapAt(base, ilvl, thresholds)` and
  `minIlvlForSockets(base, n, thresholds)` take `types[base.type].thresholds` as a third argument.
- **Extra build modules**: `build/esrSources.ts` (reads the clone's files; git stays in the script) and
  `build/generateBundles.ts` (pure orchestration) so the clone-dependent test can regenerate in memory.
  The browser loader lives in `engine/browser/loadGameData.ts`, excluded from `tsconfig.scripts.json`.
- **String priority**: `chinese-overlay.json` must lose every conflict. With plain alphabetical order it beat
  `item-gems.json` ("Chipped Skull" → "Chipped Quartz"). Of the 85 conflicts, 83 are `chinese-overlay` censored names
  (Zombie → Rotten One, Blood Moor → Scarlet Moor, …); 2 are internal UI/command strings. No base name is affected:
  the docs oracle matches 616/624 spawnable weapon/armor names with 0 differences by code; the 8 misses are the 6
  throwing potions and Arrows/Bolts, which the docs pages do not list.
- **Tier of self-referential families**: not only mythical bases point all three family columns at themselves; so do
  Magic Arrows/Bolts (`aq2`/`cq2`, spawnable, in weapons.txt) and every misc accessory. Rule used: self-referential
  family → `mythical` when qlvl ≥ 90 (mythical bases are 96, Mythical Amulet/Ring/Jewel `mam`/`mrn`/`mjw` are 100),
  else `normal`. Only 32 of the 62 mythical bases are spawnable (27 weapons, 5 armors).
- **Throwing potions** (`gps`, `ops`, …) are spawnable weapons with blank `ubercode`/`ultracode`: `family` contains `''`.
- **Quivers**: misc.txt quivers (`aqv`, `cqv`) are `spawnable = 0`; the player-facing arrows are the weapons.txt rows
  above. `bowq`/`xboq` stay in `ACCESSORY_TYPES` but currently match nothing in misc.
- **Accessories**: 32 misc bases (29 after duplicate removal, see below), not ~15 (8 class rings + 8 class amulets, duplicate charm rows `cm1-3`/`cx1-3`,
  Damage Augmenter, two Noob's Charms, mythical amulet/ring/jewel).
- **Classes**: charstats.txt has no class code column; code = first three letters of `class` (Amazon → `ama`,
  Warlock → `war`). Tab names come from `StrSkillTab1-3` strings with the `%+d to ` prefix stripped
  ("Bow and Crossbow Skills").
- **Item types**: rows with a blank `Code` (Any, Not Used, Expansion) are dropped → 188 types. Names come from the
  `ItemType` column (English, not string-resolved); collisions get the code appended: `Helm (merc)` / `Helm (helm)`,
  `Gem Can 1 (can1)` / `Gem Can 1 (can9)`.
- **Sizes**: types.json 44 KB (4.6 KB gzip), bases.json 293 KB (26 KB gzip), manifest.json 11.5 KB (2.5 KB gzip,
  mostly the 85 string-conflict warnings).
- **HTM oracle**: the repo has no `docs/weapons.htm`; the test reads the clone's `docs/weapons.htm` / `docs/armors.htm`.
- **Review fix-ups (2026-10-09)**:
  - String-conflict warnings are printed only, not stored in `manifest.warnings` (manifest 11.7 KB → 1.2 KB);
    `counts.stringConflicts` stays.
  - Mythical bases whose resolved name does not start with "Mythical" use the `name` column + warning
    (`mam`/`mrn`/`mjw` → "Mythical Amulet/Ring/Jewel").
  - Exact duplicate bases (every `BaseItem` field equal except `code`/`family`) are dropped, first in file order wins;
    `counts.duplicateBases` + one warning. ESR 3.2.10 drops only `cx1`-`cx3` (copies of `cm1`-`cm3`); weapons/armor
    have none (369/255 unchanged), misc 32 → 29. `cm8`/`c11` differ in reqLvl and are kept.
  - lint-staged also formats/lints `scripts/**/*.ts`.

## Phase 2a notes (data + engine, no UI)

- **Key count**: runes.txt has 449 `Runeword*` **rows** but 391 distinct keys (379 rune-based, 12 gem-only; 434 / 15
  rows). The bundle has one entry per key: `counts.runewords = 391`, `counts.runewordRows = 449`.
- **jew and mjw rows are separate**: a ranged recipe has one row per socket count for Jewel and another for Mythical
  Jewel (Shinigami: 9 rows). Both are kept; `codes` tell them apart.
- **Ingredient names** stay raw ("Eth Rune", "Perfect Sapphire"; misc.txt's `name` column says "Saphire", strings fix
  it). Normalisation (incl. stripping " rune"/" gem") happens only in the matcher.
- **Same name + recipe on several keys**: 29 names (Rain ×4 keys, Dream ×3, Shinigami 2hsw/mele, Fortune weap/tors, …)
  differ only in itypes, so the plan's three passes cannot tell them apart. `matchRunewords(htm, txt, { typeNames })`
  narrows ties by comparing itype/etype names with the HTM allowed/excluded items (one site label alias: `tors` →
  "Body Armor"); without `typeNames`, or when nothing fits, the match keeps all tied keys (`match.keys`, rows of all).
  The UI should pass `typeNames` built from `types.json`.
- **Match result shape**: `{ key, keys, name, rows, quality }`; `rowsForSockets(rows, htm)` selects rows within the HTM
  sockets range.
- **Real-data result** (fixture of 2026-10): 409/409 HTM rows exact, 0 ties left, 12 unmatched txt keys = the gem-only
  recipes, all matched on gemwords.htm. The integration test keeps the 95 % threshold.
- **HtmRunewordLike** is a local structural type (`name`, `variant`, `sockets`, `socketsMax?`, `ingredients?`/`runes?`,
  `allowedItems?`, `excludedItems?`); the Dexie `Runeword` and `Gemword` models satisfy it.
- **bestBase details**: `types` is a `Map<code, ItemTypeInfo>`; `character.cls` accepts `'any'`; ethereal does not apply
  to misc bases; each base is returned once with the fewest-socket qualifying row (all qualifying rows in `rows`);
  sort ties fall back to the base name for determinism.

## Phase 3a notes (stat renderer + affixes bundle + eligibility, no UI)

- **Files**: `build/stats/{tables,sprintf,skills,expandProperty,descfunc,renderLines,propertyGroups,statRenderer}.ts`
  (+ `testContext.mock.ts` shared by the tests), `build/bundleAffixes.ts`, `engine/affixEligibility.ts`, oracle test
  `statRenderer.oracle.test.ts`. `esrSources.ts` reads 10 more tables; `model.ts` gained `PropertyMod`,
  `RuneRecipeRow.mods` and `readAffixes`.
- **Schema (additive, `GAME_DATA_SCHEMA` stays 1)**: `TxtRunewordRow.text: string[]`; `Affix.reqCls` added (the
  `class` column that `clsReqLvl` applies to; `cls` is `classspecific`). `id` = row index within its file (gaps where
  rows are dropped), unique with `kind`. Counts are flat: `affixes`, `affixesPrefix`, `affixesSuffix`,
  `affixesAutomagic`, `affixesDropped` (106), `affixesPlaceholdersDropped` (4).
- **Automagic "null" rows** (17): nameless automods; kept with `name: ''` when at least one stat is visible, dropped when
  only hidden stats (`tinkerflag2`, `noconsume`) remain. The prefix "Null" has a string and is a normal affix.
- **Sizes**: affixes.json 785 KB / 57 KB gzip (plan estimate 550/40: mods are stored next to the text);
  runewords.json 197 KB / 27 KB gzip (text added).
- **PickMode** (propertygroups `*` columns are empty; verified against data + gemwords.htm): 0 = every entry applies
  (762 groups), a pick-one subgroup entry is rolled ModMin–ModMax times ("1-2 of the following:"); 1 = one entry
  weighted by Chance (650, weights 1/5); 2 = one entry (22, all Chance 1, variant alternatives) → treated like 1. A
  numeric ParMin < ParMax lists one option per param. **No `Runeword*` row and no affix references propertygroups**:
  only the charm gemword rows (Holy, Rainbow, …) and other tables do, so pools are not visible in the current bundles.
- **Property funcs**: as planned; func 17 = stat value from param (per-level stats and cold/poison/bleed length),
  12 = random skill rendered with `ChronicleItemModifierClassSkillRandom` ("+3 to a random Druid Skill"), 14 =
  `Socketable` "Socketed (%i)", 23 = `strethereal`. Funcs 18/25/36 are unused by affixes/runewords (fallback). Zero
  renderer warnings on ESR 3.2.10.
- **descfunc**: ESR uses 19 (sprintf) for most stats; bare labels only on descfunc 1/3/12/20. 13/14 use charstats
  `StrAllSkills` / `StrSkillTab1-3` + `StrClassOnly`; 22 montype `strplur`; 23 monstats `NameStr` (ESR stores mythical
  descriptions there, format `.%1%0`, descval 0 → value and leading dot dropped); 24 = (level = max, charges = min).
  Strings with `\n` are reversed (bottom-up drawing, confirmed by the docs). descfunc 12 "V omitted when 1" kept.
- **Oracle-driven rules (deviations from vanilla)**: physical (`dmg-norm`, 45 runeword uses) and magic min/max are NOT
  merged; elemental pairs are, min = max reads "Adds 75 …"; cold gets " over N Seconds"; `skill` + `oskill` of the same
  skill = "+sum to X (All Classes)" (no string exists for it). D2 rule added: identical stats (stat + param) are summed
  before the dgrp check (Ancient's Pledge `res-all` 40 + `res-cold` 30 → Cold Resist +70%), except event skills/charges.
  dgrp sets are keyed by `dgrp` + `dgrpstrpos` (ESR dgrp 6 mixes min and max elemental damage).
- **Ranges** (follow-up decision): docs style from prefixes.htm / suffixes.htm, `+(10 to 20)`, `(10 to 20)%`,
  `-(10 to 20)`, `Socketed (2 to 4)`. Damage pairs merge into "Adds X-Y" only with fixed values; rolled ranges stay
  "+(15 to 30) to Minimum Cold Damage…" / "+(31 to 60) to Maximum…" lines, as on the affix pages.
- **Type names** (follow-up): a colliding type name keeps the plain name on the type that has bases of its own
  (`helm` → "Helm", `merc` → "Helm (merc)"); `generateBundles` builds the bases first, then names the types.
- **Oracle result** (2026-10-09, fixture 2026-10): 96.5 % (2882/2985) identical after the range change, floor 94.5 %.
  Remaining classes: rolled runeword ranges where the docs show only the maximum (Cherry Blossom "+(75 to 100)%" vs
  "+100%", 8 lines), docs/game version drift (Fortress, Terminate, Unlawful, mythical texts of Moonlight, Dream,
  Phoenix, Wealth: ≈60 lines), docs parser putting a line after a blank line into the rune group ("Requirements +500%",
  Might of the Earth).
- **Eligibility**: `freq > 0` added (D2 rule; no spawnable ESR affix has freq 0). Automods ignore `rare`. The class
  rule follows the plan (class affixes are allowed on class-less bases; their itypes normally restrict them anyway).

## Phase 3b notes (Affixes page)

- **Item-type filter**: a flat picker of the types that occur in any affix's itypes, not the Bases page's grouped picker
  (that one is built from base types and dispatches Bases actions). Matching is by code only (no ancestor walk): any
  selected code in `itypes` and none in `etypes`.
- **Paging**: "Show more" (200 per page) is per list; in what-can-roll mode the prefix, suffix and automod sections
  each page on their own.
- **Item level input**: reuses `StatInput` exported from `components/CharacterForm.tsx` (number input with commit and
  range clamp) next to a slider.
- What-can-roll mode hides and ignores the level range, item types and sort; weights are computed over all eligible
  affixes before the page filters. URL keys added beyond the plan: `minlvl`, `q`, `auto`.
