# D2R ESR Runeword Browser - Documentation

This folder contains all project documentation for the D2R ESR Runeword Browser.

## Documentation Structure

### [Features](./features/)
Feature descriptions, user stories, and task breakdowns.

### [Technical](./technical/)
Architecture decisions, coding guidelines, tech stack documentation, and implementation details.

### [Data](./data/)
Game data file documentation and references.

### [General](./general/)
Project overview, design decisions, and general project information.

## Quick Links

- [Contributing & Documentation Process](./CONTRIBUTING.md) - How to continue documentation sessions

### Feature Documentation
- [Core Data](./features/CORE-DATA.md) - HTM parsing for socketables and runewords, app startup flow
- [Runewords](./features/RUNEWORDS.md) - Browse and filter runewords (primary feature, home page)
- [Socketables](./features/SOCKETABLES.md) - Unified view of all socketables (gems, runes, crystals) with filters
- [Unique Items](./features/UNIQUE-ITEMS.md) - Browse and filter unique items with data-driven type categorization

### Technical Documentation
- [Tech Stack](./technical/TECH-STACK.md) - Libraries, frameworks, and tools
- [Architecture](./technical/ARCHITECTURE.md) - Project structure and data flow
- [Navigation](./technical/NAVIGATION.md) - Routing, app shell layout, settings drawer
- [UI Components](./technical/UI-COMPONENTS.md) - Component patterns and theming
- [Coding Guidelines](./technical/CODING-GUIDELINES.md) - Conventions and standards
- [Data Models](./technical/DATA-MODELS.md) - IndexedDB schema and TypeScript types
- [Sagas](./technical/SAGAS.md) - Redux Saga patterns and architecture
- [Testing](./technical/TESTING.md) - Testing infrastructure and patterns

### Data Documentation
- [TXT Files Reference](./data/TXT-FILES-REFERENCE.md) - D2R game data files (TSV format)

---

## TXT-Based Data System (Experimental)

The app is transitioning from HTM-based parsing to TXT-based parsing using original D2R game data files. This provides access to more complete data including unique items, sets, and gemwords.

### Current Status

| Feature | HTM-based | TXT-based |
|---------|-----------|-----------|
| Socketables | ✅ Active | ✅ Parsed |
| Runewords | ✅ Active | ✅ Parsed |
| Unique Items | ❌ | ✅ Parsed |
| Sets & Set Items | ❌ | ✅ Parsed |
| Gemwords | ❌ | ✅ Parsed |

### Roadmap

The TXT-based system will eventually replace HTM parsing. Implementation order:

1. ~~**Unique Items** - Browse and filter unique items~~ ✅ Implemented
2. **Sets & Set Items** - Browse set definitions and set item components
3. **Gemwords** - Browse runewords that use gems instead of runes
4. **Socketables** - Re-implement with TXT data
5. **Runewords** - Re-implement with TXT data
6. **Deprecate HTM** - Remove HTM-based parsing

### Key Differences

| Aspect | HTM-based | TXT-based |
|--------|-----------|-----------|
| Database | `d2r-esr-runewords` | `d2r-esr-txt-data` |
| Data Source | ESR documentation site | D2R game files (TSV) |
| Runewords | ~386 | ~997 (includes gemwords) |
| Socketables | ~178 | ~178 |
| Properties | N/A (embedded in affixes) | 251 (with tooltips) |

### Technical Details

- **Feature**: `src/features/txt-data/`
- **Database**: `src/core/db/txtDb.ts`
- **TXT Files**: `public/txt/` (6 primary files)
- **Trigger**: Settings → "Parse TXT Files" button

See [TXT Files Reference](./data/TXT-FILES-REFERENCE.md) for file format documentation.

---

## Status

Documentation is actively being developed. See [CONTRIBUTING.md](./CONTRIBUTING.md) for current status and next steps.
