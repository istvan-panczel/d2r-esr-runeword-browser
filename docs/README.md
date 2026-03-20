# D2R ESR Runeword Browser - Documentation

This folder contains all project documentation for the D2R ESR Runeword Browser.

## Documentation Structure

### [Features](./features/)
Feature descriptions, user stories, and task breakdowns.

### [Technical](./technical/)
Architecture decisions, coding guidelines, tech stack documentation, and implementation details.

### [General](./general/)
Project overview, design decisions, and general project information.

## Quick Links

- [Contributing & Documentation Process](./CONTRIBUTING.md) - How to continue documentation sessions

### Feature Documentation
- [Core Data](./features/CORE-DATA.md) - HTM parsing, app startup flow, data refresh strategy
- [Runewords](./features/RUNEWORDS.md) - Browse and filter runewords (primary feature, home page)
- [Socketables](./features/SOCKETABLES.md) - Unified view of all socketables (gems, runes, crystals) with filters
- [Unique Items](./features/UNIQUE-ITEMS.md) - Browse and filter unique items parsed from HTM pages

### Technical Documentation
- [Tech Stack](./technical/TECH-STACK.md) - Libraries, frameworks, and tools
- [Architecture](./technical/ARCHITECTURE.md) - Project structure and data flow
- [Navigation](./technical/NAVIGATION.md) - Routing, app shell layout, settings drawer
- [UI Components](./technical/UI-COMPONENTS.md) - Component patterns and theming
- [Coding Guidelines](./technical/CODING-GUIDELINES.md) - Conventions and standards
- [Data Models](./technical/DATA-MODELS.md) - IndexedDB schema and TypeScript types
- [Sagas](./technical/SAGAS.md) - Redux Saga patterns and architecture
- [Testing](./technical/TESTING.md) - Testing infrastructure and patterns

---

## Data System

The app uses a single HTM-based data system. All data is fetched from the ESR documentation site (`easternsunresurrected.com`), parsed with the native `DOMParser` API, and stored in a single IndexedDB database (`d2r-esr-runeword-browser`).

### Data Sources

| Data | Source |
|------|--------|
| Socketables (gems, runes, crystals) | `gems.htm` |
| Runewords | `runewords.htm` |
| Unique Weapons | `unique_weapons.htm` |
| Unique Armors | `unique_armors.htm` |
| Unique Others | `unique_others.htm` |
| Version info | `changelogs.html` |

### Features

| Feature | Route | Description |
|---------|-------|-------------|
| Runewords | `/` | ~386 runewords with filters for runes, sockets, item types, tier points, req level |
| Socketables | `/socketables` | ~177 socketable items across 5 categories |
| Unique Items | `/uniques` | Unique weapons, armors, and other items with category filters |

---

## Status

Documentation is actively being maintained. See [CONTRIBUTING.md](./CONTRIBUTING.md) for current status and next steps.
