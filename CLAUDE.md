# CLAUDE.md

This file provides guidance for Claude when working with this codebase.

## Project Overview

D2R ESR Runeword Browser - A React SPA for browsing Diablo 2 Resurrected runewords (ESR mod).

## Tech Stack

- **Framework**: React 19 with TypeScript
- **Build**: Vite
- **Linting**: ESLint with strict TypeScript rules, React plugins
- **Formatting**: Prettier

## Commands

```bash
npm run dev          # Start dev server
npm run build        # TypeScript check + production build
npm run lint         # Run ESLint
npm run lint:fix     # Run ESLint with auto-fix
npm run release      # Create a new version (runs lint + build first)
```

## Code Style

- Prettier handles formatting (single quotes, 140 print width, trailing commas)
- ESLint uses `strictTypeChecked` - avoid `!` non-null assertions, use proper null checks
- Console logs are stripped from production builds automatically

## Git Conventions

- **Commits**: Follow [Conventional Commits](https://www.conventionalcommits.org/) format
  - `feat:` new features
  - `fix:` bug fixes
  - `chore:` maintenance tasks
  - `refactor:` code restructuring
  - `docs:` documentation
- **Pre-commit hooks**: Prettier and ESLint run automatically on staged files
- **Commit messages**: Validated by commitlint

## Versioning

Uses `commit-and-tag-version` for semantic versioning based on conventional commits.
- Tags use `v` prefix (e.g., v1.0.0)
- CHANGELOG.md is auto-generated
