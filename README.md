# D2R ESR Browser

Browse and search [Eastern Sun Resurrected](https://github.com/CelestialRayOne/Eastern_Sun_Resurrected) (ESR) mod data for Diablo 2 Resurrected:
recipes, items, skills, areas and cube recipes, plus tools for picking bases, writing loot filters and reading your own stash.

**▶ Open the app: https://istvan-panczel.github.io/d2r-esr-runeword-browser/**

## Features

**Home**: one search box across runewords, gemwords, uniques, mythicals, sets, set items, bases, skills, materials, areas
and cube recipe families, plus cards for every section, the latest builds and loot filters, and links to the official ESR
sites and community tools.

**Recipes**

- **Runewords**: search by name or affixes; filter by runes, socket count (exact or a range), item type, required level
  and max tier points
- **Gemwords**: the same filtering for gem and jewel recipes
- **Socketables**: gems, ESR/LoD/Kanji runes, crystals and jewels with all their bonuses

**Database**

- **Uniques** and **Mythicals**: unique items by category, tier and coupon
- **Sets**: every set with its items, partial bonuses per piece count and full-set bonuses
- **Ascendancies**: all ascendancies with their tier bonuses
- **Skills**: every class skill tree (Warlock included) and the items that grant each skill
- **Bases**, **Materials** and **Areas**: every base item, every misc item (runes, gems, organs, coupons and more), and
  each area's monster level per difficulty, density, waypoints and the endgame map tiers

**Tools**

- **Best Base**: the best base for a runeword and your character
- **Affixes** and **Item Types**: what can roll on a base, and the item type tree with socket caps
- **Enhance**: corruption, anointment and Vessel of Souls outcomes
- **Cube Recipes**: every cube recipe, grouped by family
- **Loot Filters**: build, test and download filters for ESR's loot filter plugin, starting from Sully's QoL template;
  save and share them with the community (sign-in required for saving)

**My Stash**: open your shared stash file to see your Ancient Coupons (the uniques they make and where they are) and every
item on your stash pages, searchable by name and stats. The file is read in your browser and never uploaded.

**Guide**: a new-player guide to what ESR changes and where to go next, with a map of how the notes connect.

**Builds**: browse, like and share character builds (creating and liking need sign-in; only available when the optional
Supabase backend is configured).

Plus:

- Item icons on the item, set, base, socketable and build pages
- Favourite runewords, gemwords and unique items (sign-in required; synced to your account, with public favourite counts)
- Shareable URLs: copy a link to your exact filter setup
- Data is cached in your browser (IndexedDB), so repeat visits load fast
- Dark/light theme, optional Diablo font, adjustable text size

## How it works

There are two kinds of game data, and neither needs a backend:

- **Recipes, socketables, uniques, mythicals and ascendancies** come from the official ESR documentation at
  [easternsunresurrected.com](https://easternsunresurrected.com/). The app fetches those pages, parses them in your browser
  and stores the result in IndexedDB. On startup it reads the mod's version from the ESR launcher metadata on GitHub and
  refreshes the data when a new ESR version is out.
- **Everything else** (sets, skills, bases, materials, areas, affixes, item types, cube recipes, loot filter data, icons
  and the guide) comes from static bundles generated from the ESR repository's game files and committed under
  `public/game-data/` and `public/guide/`.

An optional [Supabase](https://supabase.com/) backend adds sign-in (Discord or email link), shared builds, shared loot
filters and account favourites. Without it, the rest of the app works the same.

## Development

Requires Node 24 (see `.nvmrc`).

```bash
npm install
npm run test:fixtures    # fetch test fixtures (once, after checkout)
npm run dev              # start dev server
npm run build            # typecheck + production build
npm run lint             # ESLint
npm run test             # run tests
npm run game-data:update # after an ESR release: refresh the game-file bundles (clones ESR to ../Eastern_Sun_Resurrected)
```

The game-data bundles are regenerated locally and committed; CI does not generate them. The pre-commit hook formats and
lints staged files and, when `gitleaks` and `exiftool` are installed (`brew install gitleaks exiftool`), also scans for
secrets and for identifying metadata in images and PDFs.

See [docs/README.md](./docs/README.md) for the full project documentation and [docs/CONTRIBUTING.md](./docs/CONTRIBUTING.md)
for setup, commands and conventions.

Built with React 19 (+ React Compiler), TypeScript, Vite, Redux Toolkit + Redux Saga, Dexie (IndexedDB), Tailwind CSS 4
and shadcn/ui.

## Privacy and security

Signing in is optional. Account, build, loot filter and favourite data is stored on Supabase (EU). See the
[Privacy Policy](./PRIVACY_POLICY.md) for what is collected and how to request access or deletion.

Found a security problem? Please report it privately as described in the [Security Policy](./SECURITY.md), not in a
public issue.

## Eastern Sun Resurrected

- [ESR mod on GitHub](https://github.com/CelestialRayOne/Eastern_Sun_Resurrected) by CelestialRayOne
- [Official site and documentation](https://easternsunresurrected.com/): one of this app's data sources
- [Installation guide](https://easternsunresurrected.com/installation_guide.html)
- [Patch notes](https://github.com/CelestialRayOne/Eastern_Sun_Resurrected/tree/main/patchnotes) (recent releases) and
  the [changelog](https://easternsunresurrected.com/changelogs.html) (up to 3.2.02)

This is an unofficial fan site, not affiliated with the mod's authors.

## License

[MIT](./LICENSE)
