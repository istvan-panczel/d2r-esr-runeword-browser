# D2R ESR Browser

Browse and search [Eastern Sun Resurrected](https://github.com/CelestialRayOne/Eastern_Sun_Resurrected) (ESR) mod data for Diablo 2 Resurrected.

**▶ Open the app: https://istvan-panczel.github.io/d2r-esr-runeword-browser/**

## Features

- **Runewords** — search by name or affixes; filter by runes, socket count, item type, required level, and max tier points
- **Gemwords** — the same filtering for gem-based recipes
- **Socketables** — gems, ESR/LoD/Kanji runes, and crystals with all their bonuses
- **Uniques** — unique weapons, armors, and other items with category filters
- **Mythicals** — mythical unique items
- **Ascendancies** — all 15 ascendancies with their tier bonuses

Plus:

- Favourite your runeword and gemword recipes
- Shareable URLs — copy a link to your exact filter setup
- Works offline after the first load (data is cached locally)
- Dark/light theme, optional Diablo font, adjustable text size

## How it works

There is no backend. The app fetches the official ESR documentation pages from [easternsunresurrected.com](https://easternsunresurrected.com/), parses them directly in your browser, and stores the data in IndexedDB. On startup it checks the ESR changelog and automatically refreshes the data when a new ESR version is released.

## Development

Requires Node 22 (see `.nvmrc`).

```bash
npm install
npm run dev              # start dev server
npm run build            # typecheck + production build
npm run test:fixtures    # fetch test fixtures (once, after checkout)
npm run test             # run tests
```

See [docs/README.md](./docs/README.md) for full project documentation and [docs/CONTRIBUTING.md](./docs/CONTRIBUTING.md) for contribution guidelines.

## Privacy

The build-sharing feature stores account and build data on Supabase (EU). See the [Privacy Policy](./PRIVACY_POLICY.md) for what is collected and how to request access or deletion.

Built with React 19 (+ React Compiler), TypeScript, Vite, Redux Toolkit + Redux Saga, Dexie (IndexedDB), Tailwind CSS 4, and shadcn/ui.

## Eastern Sun Resurrected

- [ESR mod on GitHub](https://github.com/CelestialRayOne/Eastern_Sun_Resurrected) by CelestialRayOne
- [ESR documentation](https://easternsunresurrected.com/) — the data source for this app
- [ESR changelogs](https://easternsunresurrected.com/changelogs.html)

## License

[MIT](./LICENSE)
