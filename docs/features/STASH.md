# My Stash

The player uploads their ESR shared stash file and the app reads it in the browser. The first page is **Ancient
Coupons**: the coupons the stash holds, the unique each makes, how many are needed, the Wild Card alternative and where
every coupon lies. More stash pages can be added on the same upload (see "Adding a stash page").

Code: `src/features/stash/` (`parser/`, `db/`, `engine/`, `hooks/`, `components/`, `screens/`). Data: `stash.json`
([GAME-DATA.md → Stash](./GAME-DATA.md#stash)).

## Privacy

- The file is read with `File.arrayBuffer()` and parsed on the page. It is never sent anywhere: no request carries it,
  and the parser needs only the static `stash.json`.
- The last file that parsed is remembered in this browser only (IndexedDB `d2r-esr-stash`, see "Storage"), so the page
  works on the next visit without a new upload. **Clear** deletes it; the upload card and the file bar say so.
- The parse error details shown to the user (section, item index, item code, bit offsets) contain no item data, so they
  can be pasted into a bug report.

## Routes

| Route            | Screen               | Contents                                                                                     |
| ---------------- | -------------------- | -------------------------------------------------------------------------------------------- |
| `/stash`         | `StashLayout`        | Title, Overview / Ancient Coupons tabs, loads `stash.json`, provides the shared upload state |
| `/stash` (index) | `StashHomeScreen`    | The upload card (or the loaded file bar), then the stash pages with a one-line summary each  |
| `/stash/coupons` | `StashCouponsScreen` | The Ancient Coupons table; the upload card in its place until a file is loaded               |

Header: the **My Stash** group (`navConfig.ts`): Overview (`/stash`, `exact`, so it is not highlighted on
`/stash/coupons`) and Ancient Coupons. `/stash` is a static-bundle route (`staticBundleRoutes.ts`): it renders without
waiting for the HTM data sync.

## Upload

- **File picker** (`StashFileButton`, `accept=".d2i"`) and **drag and drop** (`useFileDrop`) on the upload card and on
  the loaded file's bar ("Upload newer file").
- **Where the file is**: `%USERPROFILE%\Saved Games\Diablo II Resurrected\mods\Eastern_Sun_Resurrected\ModernSharedStashSoftCoreV2.d2i`
  (with a copy button for the folder, to paste into the Explorer address bar). HardCore uses the HardCore stash file
  next to it. The old `SharedStashSoftCoreV2.d2i` (pre-3.2) is not supported.
- **Errors** (`StashLoadErrorPanel`; a failed upload never replaces the stash loaded before it):
  - wrong file type: not a `.d2i` (a `.d2s` character save is named as such) or larger than 16 MB; not read at all;
  - unsupported: no `0xAA55AA55` section header, the legacy stash (save version below 100), a retail D2R stash, an
    unknown D2RLoader format revision (`UnsupportedStashError.reason`);
  - parse error (`StashParseError`): the message plus a **Details** block with the section (and its page / tab), the
    item's place in the section list, the socket path, the item code when it was read and the bit offsets;
  - a remembered file that no longer parses (e.g. after a parser change) shows the same panel above the upload card;
  - the browser refusing IndexedDB (private window): the stash still loads, with a "Not remembered" notice.
- The file bar shows the file name, when the game last saved it (`File.lastModified`), when it was uploaded, and how
  many pages hold items.

## Storage

`db/stashDb.ts`: a Dexie database of its own, `d2r-esr-stash`, table `files`, one record `key: 'last'` with the raw
bytes (`ArrayBuffer`), `name`, `size`, `lastModified` and `uploadedAt`.

- Not the app's `d2r-esr-runeword-browser` database: that one is a cache of the remote HTM data, cleared on every
  data sync and deleted when Dexie cannot upgrade it.
- The **raw bytes** are stored rather than the parse result: the file is small (~220 KB with 32 pages in use), parsing
  it takes ~5–10 ms, and a parser fix or a new `stash.json` (an ESR update) then applies to the remembered file without
  a re-upload or a migration of a stored parse shape. The parsed result would be several times larger.

## Shared state (for every stash page)

`StashLayout` loads `stash.json` (`useGameData`) and renders `StashProvider` around the child routes, so the upload
survives moving between the pages. `useStash()` (`hooks/useStash.ts`) gives:

- `state`: `loading` (reading IndexedDB) / `empty` / `ready` (`file` meta + parsed `stash: StashFile`) / `error`
  (`StashLoadError`, plus the file meta when a remembered file failed);
- `bundle` (`stash.json`), `busy`, `uploadError`, `storageWarning`;
- `upload(file)`, `clear()`, `dismissUploadError()`.

`StashGate` renders the frame of a stash page: the spinner, the error panels, the upload card until a stash is loaded,
then the file bar and `children(stash, file)`.

### Adding a stash page

1. A screen under `screens/` that renders `<StashGate>{(stash) => …}</StashGate>`; its logic in `engine/` (pure,
   tested against a hand-built `StashFile` and, skipped without it, the fixture).
2. A route child of `stash` in `src/core/router/index.tsx`, an entry in `screens/stashPages.ts` (layout tab + overview
   card) and in the My Stash nav group.

## Ancient Coupons page

`engine/coupons.ts` (`collectCoupons`) walks every stash section's items (pages and the materials tab; socketed items
are never coupons) and groups the ones whose code is a `stash.json` coupon. A page item counts 1; a materials-tab stack
counts its stack size. Rows exist only for codes the stash holds at least one of; the Wild Card (`99j`) is counted for
the summary, and the blank coupons (`96j`–`98j`, no recipe) are left out.

Per row (`CouponTable`):

| Column          | Contents                                                                                                                         |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Unique          | icon (the unique's art from `icons.json`; coupons have no art of their own), link to `/uniques?name=<name>`, copy-name button    |
| Status          | Ready (have ≥ need), Ready with Wild Cards, 1 short, or —                                                                        |
| Have / need     | "2 / 3"; with have ≥ need also "2 crafts, 1 left over"                                                                           |
| With Wild Cards | the alternative recipe, "2 + 1 Wild Card" (coupons + Wild Cards)                                                                 |
| Coupon          | the coupon's display name and code                                                                                               |
| Tier            | Normal / Exceptional / Elite (`couponTiers`)                                                                                     |
| Where           | every location, "Page N · row R, col C" (1-based: page = section + 1, row = y + 1, col = x + 1; the materials tab has no number) |

- **Need** comes from the data (`qty` of the coupon-only recipe, 3 for every ESR 3.2.24 coupon), never a constant.
- **Crafts** = ⌊have / need⌋. **Ready with Wild Cards**: no craft with coupons alone, but have ≥ the alternative's
  coupons and the stash has at least its Wild Cards. Each row is judged on its own; rows marked this way share the
  same Wild Cards.
- **Summary**: kinds of coupon owned, coupons in total, uniques craftable now (with the craft total), Wild Cards owned
  (with their locations), and the Wild Card recipe per tier from the data ("8 Normal, 4 Exceptional or 2 Elite coupons
  of any kind").
- **Copy**: copies the unique's display name, for the in-game shared stash search.

Filters (always open; state in the URL, `readCouponsState` / `encodeCouponsState`):

| Param    | Values                                                    | Default  |
| -------- | --------------------------------------------------------- | -------- |
| `search` | words or `"exact phrases"` over coupon name, unique, code | none     |
| `status` | `ready`, `almost` (need − 1), `other`                     | all      |
| `tier`   | coupon type (`cpn1`, `cpn2`, `cpn3`)                      | all      |
| `page`   | an in-game page (1-based) holding one of the coupons      | all      |
| `sort`   | `status`, `coupon`, `unique`, `tier`, `have`, `location`  | `status` |
| `dir`    | `asc`, `desc` (written with `sort`)                       | `asc`    |

The default sort is ready first, then ready with Wild Cards, one short, the rest, each by count descending; every sort
breaks ties by unique name. Clicking a column header sorts by it (counts start high to low, names A to Z), clicking
again reverses.

## File format

ESR saves through D2RLoader's "extended" save format (`[d2rcore.save_format] mode = "extended"` in
`d2rloader/config/d2rloader.toml`). The parser (`parser/`) is browser-safe (no Node APIs) and reads:

- **Sections**: the file is a run of sections, one per stash tab: 1000 pages (sections 0–999, page = section + 1),
  then the materials tab (1000, tab type 1 "advanced", stacks) and the Chronicle tab (1001, tab type 2). Each starts
  with a 64-byte header: `0xAA55AA55`, stash format (2), save version, gold, section size in bytes (header included),
  season, tab type. Pages and the materials tab hold `"JM"` + a u16 item count + the items; the Chronicle holds
  `0xC0EAEDC0` + counts of recorded set items, uniques and runewords.
- **Versions**: the extended format writes save version `0x44520005` ("RD" in the high half, the format revision in
  the low half). Retail Reign of the Warlock saves have 105 (`0x69`), the old ESR stash (`SharedStashSoftCoreV2.d2i`)
  99 (`0x63`); both are rejected, as is an unknown `0x4452xxxx` revision.
- **Items** have no length prefix, so every field is read (the retail D2R 3.x order, after ResurrectedTrader/d2s-rs,
  MIT). The extended format widens fields; measured on a real ESR 3.2.24 stash (every item list ends exactly on its
  section boundary): 8 extra header bits before the mode, 16-bit stat ids, 32-bit stat params, 16-bit magic / auto
  affix ids, 17-bit rare name ids, 16-bit set / unique ids. Assumed (not in the sample): the normal-charm affix width,
  tempered names, the runeword field width.
- **Codes** are Huffman-coded as in retail; materials-tab stacks store an 8-bit stack size.
- The game data the walk needs (stat save widths, which codes are armor / weapons / charms / … and their inventory
  size, the 16 × 13 page grid) comes from `stash.json`.

## Tests

- `engine/coupons.test.ts`: aggregation (counts, crafts, status, Wild Card readiness, stacks, locations and their
  format), the summary, search / status / tier / page filters, every sort, the URL state.
- `engine/readStash.test.ts`: the upload checks and the error mapping (legacy, not a stash, parse details).
- `db/stashDb.test.ts`: save / load / clear round trip (fake-indexeddb).
- `engine/coupons.fixture.integration.test.ts`: the owner's real stash yields 541 coupons of 217 codes. Skipped without
  `test-fixtures/stash/ModernSharedStashSoftCoreV2.d2i` (gitignored; copy it from the save folder). The parser has its
  own unit and fixture tests in `parser/`.
- Generator: `src/features/game-data/build/bundleStash.test.ts` (coupon recipes, Wild Card alternative, tier labels,
  warnings, `readCouponRecipes`).

## Open questions (verify in game)

- `06j` (Bul-Kathos' Wedding Band): its Wild Card recipe has `numinputs` 4 for 2 coupons + 4 Wild Cards (a build
  warning); the recipe may not work.
- `24f` (Crystal Sword Azurewrath, uniqueitems `Azurewrath_old`) has no string; the page names it "Azurewrath" after
  its coupon. Check what the in-game stash search finds.
- Whether the in-game shared stash search matches the unique's name the copy button copies (a coupon's item name is
  "Ancient Coupon (Base, Unique)").
