# Mercenaries

The `/mercenaries` page shows every ESR hireling: where to hire it, its gold value, its skills with their level at each
level band, and its stats at those bands. The data is the generated bundle `public/game-data/mercenaries.json`.

## Files

| Path                                                | What                                                                                |
| --------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `src/features/game-data/build/bundleMercenaries.ts` | the generator (`buildMercenariesBundle`), the join tables and the checks            |
| `src/features/game-data/engine/mercenaryLinks.ts`   | URL params, difficulties, slugs, `parseMercenarySubtype`, `mercenaryHref`           |
| `src/features/mercenaries/`                         | the page: `MercenariesScreen`, `MercenaryCard`, `MercenaryTable`, `mercenariesView` |

## Bundle (`MercenariesBundle`, schema.ts)

Sources:

- `docs/skill_information.htm`, Mercenaries table (`parseSkillInfoPage`): the 16 variants and the display names. Rogue
  Scout, Eastern Sorcerer and Barbarian have one row per type (all three difficulties); the Desert Mercenary has one per
  type and difficulty ("Comb - Nightmare"), because only its skills change with the difficulty.
- `excel/hireling.txt`, Version 100 rows only (the 60 Version 0 rows are the classic game's copy): Act, Difficulty, Level,
  Gold, HP, Defense, Str, Dex, AR, Dmg-Min / Max, the four resists, Skill1..6 / Level1..6.
- `skilldetails.json`: each skill's id, class, tab, name, icon and aura / passive flag, embedded so the page does not
  load the 429 KB bundle.

Join: file `Hireling` (`FILE_HIRELING`: the file says "Eastern Sorceror") + `HireDesc` (`HIRE_DESC`, by the page's type
label) + `Difficulty` when the page's row names one. `*SubType` is unusable (every Barbarian row says "1hs").

Shape: `hirelings[] → types[] → variants[]`. A variant has `offers` (Gold and the levels available, per difficulty),
`bands` (all its level bands, ascending) and `skills` (`levels` aligned with `bands`). A row covering all difficulties
merges the rows by level: the file repeats the same band with another Gold.

Hand-kept in the generator: `HIRE_DESC`, `FILE_HIRELING`, `SUSPECT_DEXTERITY`; the `conduit hireling` / `whirlpool
hireling` aliases in `skillInfoPage.ts` `NAME_ALIASES`.

Not shown because their meaning is unverified or they are leftovers: `Mode`, `DefaultChance`, `Chance`,
`HiringMaxLevelDifference`, the resurrect columns, `*SubType`, names, `Seller`, `Class`, `Exp/Lvl`. `HP/Lvl` and `Def/Lvl`
do not fit between the bands, which is why the page has no level slider and no interpolation.

### Warnings

Warnings start with `mercenaries:`. ESR 3.3.04 has none, pinned in `bundleIntegrity.test.ts`:

- "only on the page / only in hireling.txt": the page's skill list and the file's differ (compared by resolved id, in
  any order).
- "unknown type label", "no hireling.txt row", "is on no row of the skill information page", "matches no skill": a rename
  to follow.
- "differs between difficulties": a band's stats or skill levels are no longer equal across difficulties, so the merge
  needs a look. "Gold differs": one difficulty has several Gold values.
- "the suspect dexterity … is gone": ESR fixed the value, drop the `SUSPECT_DEXTERITY` entry.

Counts: `mercenaryHirelings` 4, `mercenaryTypes` 10, `mercenaryVariants` 16, `mercenaryBands` 39, `mercenarySkills` 44.

## Page (`/mercenaries`)

- **Cards** (default): one per hireling and type at the chosen difficulty (Normal when the URL names none), a column per
  level band for the stats and skill levels.
- **Table**: one row per variant, its bands stacked inside the cells. The difficulty tab adds **All**, which lists all 16
  variants; a difficulty keeps the ones offered there and cuts them down to its bands and gold.
- Weapons are a hand-written constant (`VANILLA_WEAPONS`), always labelled "Vanilla D2R rules, not confirmed for ESR".
- The Desert Offensive Nightmare dexterity (98 / 97 where the other Desert types read 97 / 158) is shown as the file has
  it, marked with a "looks like an ESR typo" note.
- Conduit and Whirlpool link to the class skills of that name; the hirelings use their own copies, which have no
  skilldesc row.
- Gold is the file's value; whether it is the final hiring price is not verified, so the page says "file value".
- Skills link to their card on the Skills page; each card links its hireling set (`HIRELING_SETS`) on the Sets page.
- The skill cards' "Used by mercenaries" line links to the hireling here (`mercenaryHref`).

URL: `/mercenaries?hireling=<slug>&type=<slug>&difficulty=<normal|nightmare|hell>&view=table`, every part optional. A
`type` needs a `hireling` (two hirelings have a Defensive type). A value that names nothing is ignored with a note.

## Tests

`build/bundleMercenaries.test.ts` (fixture rows), `utils/mercenariesView.test.ts` (URL state, the card and table
selectors, the links), `bundleIntegrity.test.ts` (committed bundle: 16 variants, hirelings, acts, types, ascending bands,
aligned skill levels, resolved skills, sample values, no warnings).
