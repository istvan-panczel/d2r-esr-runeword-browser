# CLAUDE.md

This file provides guidance for Claude when working with this codebase.

## Project Overview

D2R ESR Runeword Browser - A React SPA for browsing Diablo 2 Resurrected runewords (ESR mod).

## Documentation

See [docs/README.md](./docs/README.md) for comprehensive project documentation including:

- Feature specifications (Core Data, Runewords, Socketables, Unique Items)
- Technical documentation (Architecture, Data Models, Navigation, UI Components)
- Coding guidelines and conventions

## Tech Stack

- **Framework**: React 19 with TypeScript + React Compiler
- **Build**: Vite
- **Linting**: ESLint with strict TypeScript rules, React plugins
- **Formatting**: Prettier

## Commands

```bash
npm run dev              # Start dev server
npm run build            # TypeScript check + production build
npm run lint             # Run ESLint
npm run lint:fix         # Run ESLint with auto-fix
npm run release          # Create a new version (runs lint + build first)
npm run compiler:check   # Check React Compiler optimization issues
npm run compiler:health  # Run React Compiler health check

# Game data (txt game files → public/game-data/*.json; needs ../Eastern_Sun_Resurrected clone)
npm run game-data:generate  # Regenerate the static game-data bundles
npm run game-data:icons     # Item icons from the ESR HD sprites, vanilla art (../d2r-vanilla-art, not in git) as fallback → public/game-data/icons/*.webp + icons.json (then the manifest)
npm run game-data:skill-icons  # Skill icons cropped from the ESR HD skill icon sheets → public/game-data/icons/skills/*.webp (keys from skilldetails.json; also run by game-data:icons)
npm run game-data:check     # Exit 1 if the committed bundles, item icons or skill icons are stale (without ../d2r-vanilla-art: vanilla-derived icons skipped with a warning)
npm run game-data:update    # After an ESR release: clone/pull ESR, generate, fetch fixtures, check, guide, full test suite
npm run esr:diff            # What changed in ESR since the committed game data (patch notes, tables, strings, docs, launcher, loot filters); --json, --from/--to <rev>, --out
npm run esr:review          # Read-only review of a regenerated update vs HEAD, the clone and the live sites; --out x.md, --offline
npm run esr:user-data       # Read-only scan of PROD's public builds/favourites/loot filters against the current data

# Testing
npm run test:fixtures    # Fetch test fixtures (required once after checkout)
npm run test             # Run tests once (CI mode)
npm run test:coverage    # Generate code coverage report
```

- After an ESR release, run the `/esr-update` skill (`.claude/skills/esr-update/SKILL.md` + `reference.md`): it runs `game-data:update`, the release diff, `esr:review` and `esr:user-data`, starts parallel review agents, applies guide/doc/template/link edits, proposes updates to itself and asks before committing.

## React Compiler

The project uses React Compiler for automatic memoization. Do NOT use manual `useMemo`, `useCallback`, or `React.memo` unless absolutely necessary (add comment explaining why).

## Code Style

- Prettier handles formatting (single quotes, 140 print width, trailing commas) for the whole repo; `.prettierignore` skips the generated bundles (`public/game-data/`, `public/guide/`), the byte-exact loot filter templates and CHANGELOG.md. `npm run prettier:format-check` must stay clean
- ESLint uses `strictTypeChecked` - avoid `!` non-null assertions, use proper null checks
- Console logs are kept in production builds (users can see parsing progress)

## Git Conventions

- **Commits**: Follow [Conventional Commits](https://www.conventionalcommits.org/) format
  - `feat:` new features
  - `fix:` bug fixes
  - `chore:` maintenance tasks
  - `refactor:` code restructuring
  - `docs:` documentation
- **Pre-commit hooks** (`.husky/pre-commit`): `scripts/check-staged-files.sh` rejects env files (other than the three committed ones), save/stash files, logs and files over 2 MB outside `public/game-data/`; lint-staged runs Prettier on every staged text file and ESLint on TypeScript, plus `scripts/check-metadata.sh` (exiftool) on images and PDFs; gitleaks scans the staged changes (`.gitleaks.toml` allows the publishable Supabase keys and the Cloudflare beacon token). The exiftool and gitleaks checks are skipped with a message when the tools are not installed (`brew install gitleaks exiftool`)
- **Commit messages**: Validated by commitlint

## Versioning

Uses `commit-and-tag-version` for semantic versioning based on conventional commits.

- Tags use `v` prefix (e.g., v1.0.0)
- CHANGELOG.md is auto-generated
