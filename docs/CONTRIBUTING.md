# Contributing

How to set up, change, test and release the D2R ESR Runeword Browser. Project overview and the full docs index:
[docs/README.md](./README.md).

## Prerequisites

- **Node 24** (the version in `.nvmrc`; `package.json` `engines` allows `>=24 <25`). With nvm: `nvm use`.
- **npm** (the one that comes with Node 24, or npm 12). `.npmrc` sets `allow-remote=all`: npm 12 defaults to `none`,
  which breaks dry runs and lockfile-only resolves on one fallback tarball. The lockfile's integrity hashes still pin
  every package.
- Optional, for the game-data workflow: a clone of the ESR repo next to this one (see below).
- Optional, for the pre-commit checks: `brew install gitleaks exiftool`.

## Setup

```bash
npm install            # also installs the husky git hooks (prepare script)
npm run test:fixtures  # once after checkout: downloads the HTML fixtures the integration tests need (not committed)
npm run dev            # dev server
```

The app runs without any backend. Sign-in, builds, favourites and loot filter sharing use Supabase (see below).

## Commands

```bash
npm run dev              # dev server
npm run build            # TypeScript check + production build
npm run preview          # serve the production build
npm run lint             # ESLint
npm run lint:fix         # ESLint with auto-fix
npm run test             # all tests once (Vitest)
npm run test:watch       # tests in watch mode
npm run test:coverage    # coverage report
npm run compiler:check   # React Compiler problems that ESLint can report
npm run compiler:health  # React Compiler health check
npm run guide:generate   # compile content/guide/ into public/guide/ and rewrite public/sitemap.xml
npm run guide:check      # exit 1 if the guide bundle or the sitemap is stale
npm run release          # lint + build, then bump the version, update CHANGELOG.md and tag
```

## Game data

The Game Data, Sets, Skills, Cube, Stash and loot filter pages use JSON bundles generated from the ESR txt game files
and committed under `public/game-data/`. CI never generates them. The generator reads a clone of the ESR repo at
`../Eastern_Sun_Resurrected` (a sibling of this repo); `game-data:update` creates it on the first run.

```bash
npm run game-data:update    # after an ESR release: clone/pull ESR, generate, fetch fixtures, check, full test suite
npm run game-data:generate  # regenerate the bundles from the current clone
npm run game-data:icons     # item icons (also reruns the bundles and skill icons)
npm run game-data:skill-icons
npm run game-data:check     # exit 1 if the committed bundles or icons are stale
npm run esr:diff            # what changed in ESR since the committed game data
npm run esr:review          # read-only review of the regenerated data (run after game-data:update)
```

Item icons come from the mod's HD sprites. For items the mod has no art for, the generator falls back to vanilla D2R art
extracted to `../d2r-vanilla-art` (not in git). That folder is optional: without it, `game-data:check` skips the
vanilla-derived icons with a warning. Details: [Game Data → Regenerating](./features/GAME-DATA.md#regenerating).

## Supabase environment

Vite loads `.env.development` for `npm run dev` and `.env.production` for `npm run build`. Both are committed and hold
only the Supabase URL and the publishable (anon) key, which ship in the browser bundle anyway; row-level security does
the authorisation. Secrets (service-role keys, test user passwords for the maintenance scripts) go in `.env.local`,
which git ignores. `.env.example` lists every variable. Setup of the Supabase projects:
`builds-feature-docs/SUPABASE-SETUP.md`.

## Code style

- TypeScript with ESLint `strictTypeChecked`: no `!` non-null assertions, use real null checks.
- React 19 with the React Compiler: do not add `useMemo`, `useCallback` or `React.memo` by hand unless the compiler
  cannot cover the case, and then say why in a comment.
- Prettier formats everything (single quotes, 140 print width, trailing commas) except what `.prettierignore` lists: the
  generated bundles, the byte-exact loot filter templates and CHANGELOG.md. `npm run prettier:format-check` checks it all.
- More conventions: [Coding Guidelines](./technical/CODING-GUIDELINES.md), [Testing](./technical/TESTING.md).

## Commits

Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `chore:`,
`refactor:`, `docs:`, `perf:`, `test:`), checked by commitlint in the `commit-msg` hook. The type decides the next
version and the CHANGELOG section.

The `pre-commit` hook runs:

- a staged-file check that refuses save and stash files, logs, env files other than the three committed ones, and
  files over 2 MB outside `public/game-data/`;
- lint-staged: Prettier on every staged text file, ESLint on TypeScript;
- a gitleaks secret scan of the staged changes;
- an exiftool check that staged images and PDFs carry no identifying metadata (GPS position, author, owner).

gitleaks and exiftool are optional: when one is missing, its check is skipped with a message. Install both with
`brew install gitleaks exiftool`.

## Releasing and deploying

`npm run release` runs lint and the build, then `commit-and-tag-version` bumps `package.json`, writes CHANGELOG.md and
creates a `vX.Y.Z` tag. Push the commit and the tag yourself. Deploying to GitHub Pages is a manual run of the
"Deploy to GitHub Pages" workflow in the Actions tab; pushing to `master` does not deploy.

## Documentation

- [docs/README.md](./README.md): the index, data sources and routes.
- `docs/features/`: one file per feature (behaviour, data, decisions, open questions).
- `docs/technical/`: architecture, navigation, data models, sagas, UI components, testing.
- `builds-feature-docs/`: the Supabase-backed features (builds, favourites, loot filter sharing) and the loot filter
  format guide.

Update the feature doc in the same change as the code it describes.
