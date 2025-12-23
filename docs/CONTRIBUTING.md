# Documentation Process Guide

This document serves as the entry point for continuing documentation sessions with Claude. Link this file when resuming work on project documentation.

## Purpose

This project uses an iterative documentation process where:
1. The developer shares project details, requirements, and decisions
2. Claude maintains and updates documentation in the `docs/` folder
3. Documentation evolves as the project develops

## How to Continue a Session

1. Start a new conversation with Claude
2. Link this file: `docs/CONTRIBUTING.md`
3. Claude will review current documentation status and continue from where we left off
4. Share new information about features, technical decisions, or requirements

## Topics to Cover

- [x] **Tech Stack** - Libraries, frameworks, and tools
- [x] **UI Components** - Component patterns, styling approach, design system
- [x] **Architecture** - Project structure, data flow, state management
- [x] **Coding Guidelines** - Conventions beyond what's in CLAUDE.md
- [x] **Features** - Core functionality and user-facing features

## Current Status

### Completed
- Initial documentation structure created
- Tech stack documented (React 19, Vite, shadcn/ui, Redux Toolkit + Saga, Dexie.js)
- Architecture documented (folder structure, feature modules, data flow)
- UI component guidelines (shadcn/ui usage, theming, dark/light modes)
- Coding guidelines (TypeScript, React, Redux conventions)
- **Core Data feature** - HTML parsing for all 5 categories, app startup flow, version checking
- **Runewords feature** - Browse/filter UI, affix selector, search, rune tooltip
- **Socketables feature** - Unified view with category checkboxes and text search
- **Runes feature** - ESR/LoD/Kanji runes with sub-tabs, tier grouping
- **Gems feature** - 8 gem types × 6 quality tiers, filtering
- **Crystals feature** - 12 crystal types × 3 quality tiers
- **Navigation** - Routing (/, /socketables, /runes, /gems, /crystals), settings drawer
- **Data Models** - Complete Dexie schema with 8 tables (gems, esrRunes, lodRunes, kanjiRunes, crystals, runewords, affixes, metadata)
- **Sagas** - Redux Saga patterns (pipeline pattern, dynamic registration, parallel operations)
- **Testing** - Vitest setup, unit tests, integration tests, database testing patterns

### In Progress
- (ready for implementation)

### Pending
- Implementation of documented features

## Documentation Guidelines

- All docs in Markdown format
- Place files in appropriate subdirectory:
  - `features/` - Feature specs, user stories
  - `technical/` - Architecture, guidelines, tech stack
  - `general/` - Overview, decisions, general info
- Update this file's status section after each session
- Keep docs concise but comprehensive

## Notes for Claude

When continuing documentation:
1. Read this file first to understand current status
2. Review existing docs in subdirectories for context
3. Ask clarifying questions when requirements are ambiguous
4. Suggest improvements to libraries, patterns, or approaches when relevant
5. Update the status section after making changes
