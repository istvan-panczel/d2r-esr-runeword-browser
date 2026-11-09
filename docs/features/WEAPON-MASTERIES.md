# Weapon Masteries

The `/weapon-masteries` page: what each weapon mastery does, how to get, apply and remove one, per class weapon. Built
from `masteries.json` (mapping: [Game Data → Weapon mastery](./GAME-DATA.md#weapon-mastery)), a static bundle, so the
page renders before the HTM data sync finishes (`src/core/layouts/staticBundleRoutes.ts`).

`src/features/weapon-masteries/`: `screens/WeaponMasteriesScreen.tsx`, `components/HowItWorks.tsx`,
`components/MasteryFamilyCard.tsx`, `utils/masteriesView.ts` (+ test). Bundle helpers and links shared with other features
live in `src/features/game-data/utils/masteries.ts`.

## The page

- A how-it-works panel (collapsible, open by default, `weaponMasteries.howToOpen` in localStorage): find, awaken, apply
  and remove, then the rules (no raw power, one per weapon on any tier, no dual-wield stacking unless the text says so,
  Orb / Claw / Void Blade take two, True Master), with links to the guide note, the Cube page family and the official page.
  The drop odds come from the official page (`pageRules`) and say so; the rest follows the cube rows and strings.
- Class chips and a weapon / skill search box (local state, not in the URL). The search looks through the weapon label, its
  base names, the skills lines and the skill names, not the effect sentences; the "also accepted" bases are left out
  (`filterFamilies`).
- 17 weapon-family cards grouped by class, in game order. A family is one awakened token (`masteryFamilies`): Orb, Claw and
  Void Blade have two options named by the gem that differs (`optionGem`). Per card: the art, the base names with a Bases
  page link, per option the recipe (`MasteryRecipe`), the effects with the skill peek (`MasteryEffectText`), the apply rows'
  other mods, the official-page footnote and differences, then the removal.
- Below the cards: the class weapons with no apply row (the 6 Assassin knuckle bases; the official page says any class
  weapon), the collapsed "also accepted" list, and one line on the official page differences.

Skill icons are not shown: they need the 429 KB `skilldetails.json`. Item icons come from `icons.json` (bases by base code,
tokens and ingredients by item code).

## URL

`/weapon-masteries?cls=<class code>&mastery=<slug>`, both optional and kept stable (other pages and the guide link here;
`masteryHref`). `mastery` scrolls to and highlights an option. A class chip that would hide the focused mastery is dropped, so
a deep link always shows its card. A value that names nothing shows a note (`readMasteriesState`).

Links back: the weapon base card panel (`WeaponMasterySection`), the skill card (`SkillMasteries`), the True Master perk card
(`PerkCard`) and the guide note.

## Bundle fields the page uses

Added to `masteries.json` by `build/bundleMasteries.ts`:

- `slug` per mastery: the property without `weapon-mastery-` (`stag-bow`, `orb-1`).
- `baseNames`: code → name for every base the masteries and `noMasteryBases` name, so the page does not need the 364 KB
  `bases.json`. It is why the integrity test's size cap is 24 KB.
- `otherBases` per mastery: apply-row codes that are not spawnable bases, `kind` from the row's own description (`lod`,
  `mythical`, `other`). ESR 3.3.03: 6 LoD copies and 6 mythicals, shown in the collapsed list.
- `noMasteryBases`: weapon bases of a class no apply row takes (the 6 knuckles).
- `noRunewords`: every apply row has the `nru` qualifier on input 1.
- `pageRules`, `pageNotes`, `pageDiffs`: see below.

## The official page

`build/masteryPage.ts` (`parseMasteryPage`) reads `docs/weapon_mastery.html` from the clone, the same file as the official
page: the two drop chances from the intro (`pageRules`; the sentence must still say "not scaled by /players") and the
Specializations table (weapon, ingredients, orange skills lines and their effect lines, grey `*` footnotes).
`compareMasteryPage` pairs each row with a mastery by weapon and ingredients (the gem tells Orb, Claw and Void Blade apart)
and records where the page differs in `pageDiffs`. Case, curly quotes, full stops and the footnote mark do not count. The
game files win: a card shows the strings and an "official page reads differently" note. Footnotes the files cannot show go to
`pageNotes` and are shown marked "Official page only" (the Claw discharge-proc note).

ESR 3.3.03 has 3 differences: Stag Bow ("20% effect" in the string), Fend ("resist" against "resistance") and the Orb skills
line ("Spells" against "Sorceress Spells").

## Warnings: text against formulas

The skills a card lists are only those the text names. `formulaMismatches` compares that list with the class skills whose
skills.txt formulas read the mastery's stat, and reports each disagreement as a `masteries:` warning, which `esr:review`
shows; nothing about it appears on the page. A mastery no formula reads is skipped. ESR 3.3.03: Blessed Edge (Crucify, Vengeance,
Judgement read the stat unnamed), Oak Branch (Twin Fangs, Ferocious Bite, Thunderclaws unnamed; Contagion named without
reading it), Ritualistic Dagger (Terror and Confuse named without reading it).

## Guards

`bundleIntegrity.test.ts` pins the 20 specialisations, 17 families, unique slugs, the knuckle gap, the other bases, the drop
odds, the 3 page differences and the warnings. `npm run esr:review` compares the bundle by `property` and reports changed page
differences. The parser, the comparison and the page state have unit tests (logic only, no components).
