# D2R ESR Browser

Browse and search [Eastern Sun Resurrected](https://github.com/CelestialRayOne/Eastern_Sun_Resurrected) (ESR) mod data for Diablo 2 Resurrected.

**▶ Open the app: https://istvan-panczel.github.io/d2r-esr-runeword-browser/**

## Features

- **Home** — one search box across runewords, gemwords, uniques, mythicals, sets, set items and bases, plus a map of everything below
- **Runewords** — search by name or affixes; filter by runes, socket count, item type, required level, and max tier points
- **Gemwords** — the same filtering for gem-based recipes
- **Socketables** — gems, ESR/LoD/Kanji runes, and crystals with all their bonuses
- **Uniques** — unique weapons, armors, and other items with category filters
- **Mythicals** — mythical unique items
- **Sets** — every set from the game files with its items, partial bonuses per piece count and full-set bonuses
- **Ascendancies** — all 15 ascendancies with their tier bonuses
- **Builds** — browse, like, and share character builds (creating and liking require sign-in; only available when the optional Supabase backend is configured)

Plus:

- Favourite runewords, gemwords, and unique items (sign-in required; synced to your account, with public favourite counts)
- Shareable URLs — copy a link to your exact filter setup
- Works offline after the first load (data is cached locally)
- Dark/light theme, optional Diablo font, adjustable text size

## How it works

The item data needs no backend: the app fetches the official ESR documentation pages from [easternsunresurrected.com](https://easternsunresurrected.com/), parses them directly in your browser, and stores the data in IndexedDB. On startup it checks the ESR changelog and automatically refreshes the data when a new ESR version is released. An optional [Supabase](https://supabase.com/) backend adds sign-in, shared builds and account favourites; without it configured, the rest of the app works as before.

## Development

Requires Node 24 (see `.nvmrc`).

```bash
npm install
npm run dev              # start dev server
npm run build            # typecheck + production build
npm run test:fixtures    # fetch test fixtures (once, after checkout)
npm run test             # run tests
npm run game-data:update # refresh game-file bundles after an ESR release
```

The Game Data pages use static bundles converted from the ESR repo's txt game files. They are regenerated locally with
`npm run game-data:update` and committed under `public/game-data/` (CI does not generate them); the first run creates
the ESR clone at `../Eastern_Sun_Resurrected` automatically.

See [docs/README.md](./docs/README.md) for full project documentation and [docs/CONTRIBUTING.md](./docs/CONTRIBUTING.md) for contribution guidelines.

## Privacy and security

The build-sharing feature stores account and build data on Supabase (EU). See the [Privacy Policy](./PRIVACY_POLICY.md) for what is collected and how to request access or deletion.

Found a security problem? Please report it privately as described in the [Security Policy](./SECURITY.md), not in a public issue.

Built with React 19 (+ React Compiler), TypeScript, Vite, Redux Toolkit + Redux Saga, Dexie (IndexedDB), Tailwind CSS 4, and shadcn/ui.

## Eastern Sun Resurrected

- [ESR mod on GitHub](https://github.com/CelestialRayOne/Eastern_Sun_Resurrected) by CelestialRayOne
- [ESR documentation](https://easternsunresurrected.com/) — the data source for this app
- [ESR changelogs](https://easternsunresurrected.com/changelogs.html)

## License

[MIT](./LICENSE)
