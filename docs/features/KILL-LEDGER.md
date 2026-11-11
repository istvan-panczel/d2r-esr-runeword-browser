# Kill Ledger

The Kill Ledger is a book every character gets from the Starter Pack. It counts kills and takes permanent bonuses: 7 at
kill milestones (in order) and 17 from endgame map bosses (any order, within 60 seconds of the kill).

The `/kill-ledger` page is a reference: it lists every bonus and how each one unlocks. It does not track progress. The
data is the generated bundle `public/game-data/killledger.json`; the official page (`docs/kill_ledger.htm`) is only
compared with it.

## Files

| Path                                               | What                                                                     |
| -------------------------------------------------- | ------------------------------------------------------------------------ |
| `src/features/game-data/build/bundleKillLedger.ts` | the generator (`buildKillLedgerBundle`, `readKillValues`, `comparePage`) |
| `src/features/game-data/build/killLedgerPage.ts`   | parser of the official page (kill and boss rows, the 60 second line)     |
| `src/features/kill-ledger/`                        | the page: `KillLedgerScreen`, the two bonus tables, `killLedgerView`     |

## Bundle (`KillLedgerBundle`, schema.ts)

Sources, all in the ESR clone, with what comes from each:

- `cubemain.txt` (through `cube.json` recipes and the raw rows): the 7 tier rows (`kill_base` ≥ N, op 3), the 21 boss
  rows (`kill_check`, op 6, value = the boss), ingredients, bonuses (rendered from the row's mods, without the
  `mythicaldesc` tooltip hints and `kill-ledger-*` markers), the Starter Pack (`ag8`, 8 class rows) and
  "Another Adventurer's Pack" (2 tomes → `ag8`).
- `d2rloader/config/celestialrayone.ascendancies.toml` (ESR 3.3.04+): which monster gives which `kill_check` value.
  Since 3.3.04 the ascendancies plugin credits boss kills (to every living player in the boss's level): each
  `[[kill_credit]]` table lists its `monsters` (monstats.txt row index, `*hcIdx`), `value` and, for the uber form
  (maximum life above `maxhp_above`, 2 billion), `value_above`. 60 seconds is `kill_credit_frames` (1500) / 25.
- `monprop.txt` + `skills.txt`, the fallback without that config (ESR 3.3.03 and older, where the bosses still carried
  the curse): a monster's `death-skill` prop names the skill; `Just Killed Boss` (811) writes the skill level (`max`),
  the others (`clc1?a:b`, 381 / 382 / 814) write fixed values, one for normal monsters, one above 2 billion max life;
  the window is their `auralencalc` (1500 frames) / 25.
- `areas.json` `mapBosses` (the monstats ids match): the readable name, map tier, arenas and names.
- `misc.txt` `spelldescstr` of `led` (`leddesc` string): the tooltip lines, reversed to reading order.
- `docs/kill_ledger.htm`: only `pageDiffs`.

Boss rows are grouped by their `kill-ledger-*` marker, so a boss with two forms is one entry: The Lich King has 2 rows
(values 40 and 48), Rathma 4 (99 and 100 alone, 208 and 210 with Kor'nac). A row labelled `A + B` takes the sum of two
monsters' values; only the direct value names the boss, so Kor'nac is not listed. The Eternal Ancients are one bonus
with three monsters (all value 60); the entry takes its name from the row's label.

### Page comparison

Differences go to `pageDiffs` (the files win, the page lists them under "Official page differs"): counts and window
seconds as numbers, tier and boss ingredients, boss names (`bossKey` ignores spelling so rows still match, then the
exact name is compared; group bosses have no file name to compare), bonus numbers (wording differs, numbers count).
At ESR 3.3.04: "Lucion Whisper" and "Fallen Ancient Angel" (files: "Lucion's Whisper" and "Ancient Fallen Angel"), and
"Flawed Tourmaline" on the Eternal Ancients row (files: Flawed Tainted Tourmaline). The page has 17 boss rows and the
files 21 (see the two-form bosses above); the bundle has 17 bosses, so the count does not differ.

The `void` trap rows (28 tier order or repeat, 17 boss repeat, 15 "All Recipes") are not read; the page states the
player-facing rule in plain words, as the official page does.

## Guards

- `bundleIntegrity.test.ts`: 7 ascending tiers, 17 bosses, each with a monster, area, map tier, bonus and resolved
  icons, the exact `pageDiffs`.
- `esr:review` (`BUNDLE_SPECS`): keyed by tier, boss id and `pageDiffs` subject.
- Warnings (`killledger:`): a kill value with no monster, a boss label that does not match its monster, a monster
  outside `mapBosses`, a page row that matches no boss, a boss without a page row.

## Cube

The Cube page's Kill Ledger rows stay as they were; the section links here (`CubeSection.page`). The merged Rathma row
needed a condition: its four rows now read "Needs a recorded Rathma kill" (`bossNameOf` in `bundleCube.ts` folds the
labels of a boss's rows).
