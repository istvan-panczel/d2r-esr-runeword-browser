# UI Components

## Component Organization

### Base Components (shadcn/ui)

Location: `src/components/ui/`

Foundational components installed via shadcn/ui CLI, styled with Tailwind CSS:

- `accordion.tsx` - Collapsible sections / mobile nav groups (Radix UI)
- `avatar.tsx` - User avatars (Radix UI)
- `badge.tsx` - Status/category badges
- `button.tsx` - Buttons with variants
- `card.tsx` - Card containers
- `checkbox.tsx` - Checkbox inputs (Radix UI)
- `command.tsx` - Command palette / searchable lists (cmdk)
- `dialog.tsx` - Modal dialogs (Radix UI)
- `dropdown-menu.tsx` - Dropdown menus (Radix UI)
- `input.tsx` - Text inputs
- `input-group.tsx` - Input with clear button
- `label.tsx` - Form labels (Radix UI)
- `navigation-menu.tsx` - Header group menus (Radix UI; used with `viewport={false}`)
- `popover.tsx` - Popover overlays (Radix UI)
- `select.tsx` - Select inputs (Radix UI)
- `sheet.tsx` - Slide-out panels / mobile menu (Radix UI)
- `skeleton.tsx` - Loading placeholders
- `slider.tsx` - Range sliders (Radix UI)
- `sonner.tsx` - Toasts
- `spinner.tsx` - Loading spinner
- `textarea.tsx` - Multi-line text inputs

All Radix primitives come from the unified `radix-ui` package, so a new shadcn component needs no extra dependency.

### App Shell Components

Location: `src/core/components/`

- `Header.tsx` - Top bar: brand, grouped navigation (Recipes / Database / Tools menus, Guide, Builds) rendered from
  `src/core/navigation/navConfig.ts`, ESR links, theme, GitHub, auth and settings controls; mobile sheet with an accordion.
  See [NAVIGATION.md](./NAVIGATION.md#header-components).
- `SettingsDrawer.tsx` - Settings sheet (theme, font, text size, data refresh, versions, credits).
- The terror zone widget (`src/features/terror-zones/components/TerrorZoneWidget.tsx`) - Floating tracker, bottom-left
  on every page but `/terror-zones`, mounted once by `AppLayout` (lazy). Open: a card with the current zone group, a countdown, the next 3
  (12 with "Show more"), star toggles, the boost line and a link to `/terror-zones`; minimised: a round outline icon
  button in the same glass as `ScrollToTopButton`, with a `warning` ring and dot when a watched group is up. `z-40` (dialogs and sheets
  cover it), safe-area insets, lifted above the app's fixed bottom bars. See
  [TERROR-ZONES.md](../features/TERROR-ZONES.md#widget).
- `navTabClasses.ts` - `TAB_BASE` / `TAB_INACTIVE` / `TAB_ACTIVE` for the header nav, `SUBTAB_BASE` / `SUBTAB_INACTIVE` /
  `SUBTAB_ACTIVE` for the page sub-tabs (see [Toolbar card and sub-tabs](#toolbarcard-and-sub-tabs)).

### Shared Components

Location: `src/components/`

Reusable components used across features:

- `PageShell.tsx` - Page width + title row (see [Page pattern](#page-pattern))
- `pageWidthClasses.ts` - The Page width setting's classes: app frame, `PageShell` `wide` width (see [`PageShell`](#pageshell))
- `PageHeader.tsx` - The title row itself: title (+ count), actions, meta line, tab row
- `FilterPanel.tsx` - Card surface around a page's filter controls
- `ToolbarCard.tsx` - The same card surface, compact, around a page's sub-tab row and top controls
- `FilterGroup.tsx` - `FilterGroup` (one labelled checkbox row), `FilterGroupList`, `FilterGroupHeader`
- `ResultsBar.tsx` - The "Showing N …" line with chips and list toggles
- `SectionHeader.tsx` - In-page section heading with a hairline (Build detail, Cube and Materials sections)
- `CopyLinkButton.tsx` - Copy shareable URL to clipboard
- `CopyLinkHelpButton.tsx` - Help info for copy link
- `ScrollToTopButton.tsx` - Floating action button to scroll to top, mounted once by `AppLayout` so screens never add it (bottom-right, `z-40`; the terror zone widget takes bottom-left)
- `floatingElements.ts` - What `ScrollToTopButton` and the terror zone widget share: the glass button classes and the lift above the app's fixed bottom bars
- `SearchHelpButton.tsx` - Search syntax help (quoted phrases, AND logic)
- `PeekPopover.tsx` + `useHoverPopover.ts` - The hover / focus "peek" popover (mouse and `:focus-visible` only, 300 ms
  delay, so a touch tap never traps): one popover per trigger (`trigger` + `peek.triggerProps`: guide note links, glossary
  terms, graph nodes) or one shared by many triggers through event delegation (`anchorRef` + `peek.delegate`: the campaign
  map's areas, `campaign-map/hooks/useAreaPeek.ts`). The guide passes its prose font as `className`
- `ExternalLink.tsx` - Link that opens in a new tab (`noopener noreferrer`) with a ↗ icon and a screen-reader "(opens in a new tab)" hint (guide, home community tools)

## Page pattern

Every browser page (Runewords, Gemwords, Unique Items, Mythicals, Ascendancies, Socketables, the Game Data tabs, Builds,
Loot filters, guide notes) is built the same way, top to bottom:

```
PageShell            one centred width + the title row
  PageHeader         "Title (count)"                         [actions]
                     meta line (e.g. the Game Data version lines)
                     ToolbarCard: sub-tab row (Game Data, My Stash)
  (intro paragraph)  optional, e.g. the Game Data tab descriptions
  FilterPanel        rounded-xl card: search row first, then option rows / FilterGroup rows
  ResultsBar         "Showing N …" · ExactNameChip            [Favorites only]
  results            card grid / sections (SectionHeader)
```

### `PageShell`

```tsx
<PageShell title="Runewords" count={shown.length} actions={…} meta={…} nav={…} width="wide">
  …
</PageShell>
```

- `width`: `wide` (default, centred) or `narrow` (`max-w-2xl`, the guide spine's reading column, the same in every
  Page width mode). `wide` follows the **Page width** setting (Settings drawer + the header's ↔ menu, see
  [NAVIGATION.md](./NAVIGATION.md#settings-contents)); the classes live in `src/components/pageWidthClasses.ts`:

  | Mode               | `PageShell` `wide`              | App frame (header row + `<main>`)                 |
  | ------------------ | ------------------------------- | ------------------------------------------------- |
  | Standard (default) | `max-w-7xl` = 1280 px           | Tailwind `container` (stepped, 1536 px at `2xl`)  |
  | Wide               | `max-w-9xl` = 1920 px           | `max-w-[122rem]` = the 1920 px page + the gutters |
  | Full               | `max-w-none` (the gutters only) | `w-full`                                          |

  Standard is the look from before the setting: the header row still spans the 1536 px container while the pages sit
  centred at 1280 px inside it. In Wide and Full the header's logo and icons line up with the page edges. Widths are
  rem based (they grow with the Text size setting; px figures are at 16 px). The standard `wide` width was chosen
  because it is the width Builds already used, it fits three result cards per row at 1280 px and it stops the card grids
  from stretching edge to edge on large monitors. The home page keeps its own `max-w-5xl` landing column in every mode
  and is the reference for the card look.

- **Container queries**: the shell is the `page` size container (`@container/page`), so content can follow the page's
  real width instead of the viewport. Steps (`src/index.css` `@theme`, also usable as `max-w-*`): Tailwind's `@3xl`
  768 px, `@5xl` 1024 px, `@7xl` 1280 px, plus `@8xl` 1536 px (4 cards), `@9xl` 1920 px (5), `@10xl` 2400 px (6),
  `@11xl` 2880 px (7). Keep a grid's viewport classes (the Standard layout) and add columns from `@8xl/page:` up
  (`grid sm:grid-cols-2 lg:grid-cols-3 @8xl/page:grid-cols-4 @9xl/page:grid-cols-5`): a Standard page is never wider
  than 1280 px, so it never matches them. Always name the container (`/page`); a bare `@8xl:` queries the nearest
  container of any kind (shadcn's `CardHeader` is one). `container-type: inline-size` leaves `position: fixed`
  (the guide note's phone bar) and `sticky` columns working. Bordered `divide-y` row lists
  (Enhance outcomes, cube rows, materials) use CSS columns instead: `ROW_LIST_COLUMNS` in
  `src/features/game-data/components/rowListColumns.ts`. Those lists sit on the card surface, never on the bare page:
  `LIST_CARD_CLASS` (same file) is the card; a Materials group or a cube family is one card with a
  `LIST_CARD_HEADER_CLASS` header (title, count, links) and its sub-blocks (Gem, Rune…, a recipe shape) as
  `LIST_CARD_SUBHEAD_CLASS` bands above their rows; an Enhance outcome list is a card on its own.
- Screens that set their own frame: the home page (`max-w-5xl`), the guide note (`max-w-2xl`, `lg:max-w-7xl` in every
  mode: a reading column plus the graph aside), the guide overview (`max-w-2xl`, from `lg` the setting via
  `PAGE_WIDE_LG_CLASS`) and the build detail with the player sidebar (Standard: breaks out of the container to a 1920 px
  cap; Wide and Full: fills the app frame, so it lines up with the header, and is itself the `page` container: from
  `@10xl` a weapon swap sits beside the player gear, and without one the gear column stops at 120rem). The user profile
  uses a width-only `PageShell`. The guide map graph (kept in the code, no longer routed) is never taller than the window minus
  15rem (never capped below 48rem, the Standard graph height), so a Full page does not get a graph taller than the screen.
- `title` omitted: the shell only sets the width. Layout routes use this (`GuideLayout`, `LootFilterLayout`) and their
  children render their own headers (the loot filter editor's inline-editable name, the guide note's breadcrumb card).
  Nested shells are harmless (the same `mx-auto max-w-*`; `/page` container queries resolve to the innermost one).
- `count` renders as "Title (N)" inside the `h1`, so the accessible name stays "Runewords (409)".
- `actions` sit right of the title and wrap under it on phones (Builds: "Create Build"; Guide: the map link).
- `meta` is a muted line under the title; `nav` is a sub-tab row, rendered on a `ToolbarCard` (`GameDataLayout`,
  `StashLayout`).

`PageHeader` is the same title row without the width, for a screen whose layout route already sets it.

### `FilterPanel`

```tsx
<FilterPanel>                      {/* aria-label "Filters" */}
<FilterPanel label="What can roll on a base?">
<FilterPanel title="Filters" actions={<CopyLinkButton … />}>   {/* optional header row */}
```

The home page's card surface (`rounded-xl border bg-card p-4 sm:p-6 shadow-sm`, `space-y-4` between its rows, `mb-6`).
It is a `section` region named by `title` or `label`. It never collapses, also not on phones. Each page keeps the
controls it had (Copy Link, Reset filters) where they were; the header row is optional and unused so far. Inside the
panel the search row comes first; option rows (checkboxes, pills, selects) follow.

### `ToolbarCard` and sub-tabs

```tsx
<ToolbarCard>                                   {/* rounded-xl border bg-card p-2 sm:p-3 shadow-sm, space-y-3 */}
  <nav aria-label="Map sections" className="flex gap-1 overflow-x-auto">
    <Link className={cn(SUBTAB_BASE, active ? SUBTAB_ACTIVE : SUBTAB_INACTIVE)} aria-current={…}>Act I</Link>
  </nav>
</ToolbarCard>
```

**Rule: page sub-tabs and top controls sit in a toolbar card; the header nav keeps `TAB_*`.** On the bare page
background the sub-tab rows, search boxes and toggles were hard to see, so they sit on the filter panels' card surface,
and the page title, meta line and intro stay outside it. A plain `div` (the controls inside carry their own `nav
aria-label` / `role="tablist"` / labels); pass `className` to lay the children out in a row instead of the default
`space-y-3` stack.

- Sub-tab classes (`src/core/components/navTabClasses.ts`): `SUBTAB_BASE` (`px-3 py-1.5`, inset `focus-visible` ring so
  a sideways-scrolling row does not clip it), `SUBTAB_INACTIVE` (muted text, `bg-accent` on hover) and `SUBTAB_ACTIVE`
  (`bg-primary text-primary-foreground shadow-sm`: the filled pill the default `Button` and the selected filter pills
  use, dark brown in light mode and near white in dark mode; the header's `bg-accent` pill hardly shows on `bg-card`).
  Roles and states are unchanged: route tabs are `NavLink`s / `Link`s (`aria-current`), the Enhance sections are
  `aria-pressed` buttons, the loot filter editor tabs a `role="tablist"`.
- Where they are used:

  | Page                          | In the card                                                                                   |
  | ----------------------------- | --------------------------------------------------------------------------------------------- |
  | Game Data, My Stash (layouts) | the sub-page tabs (`PageShell` `nav`)                                                         |
  | Enhance                       | Corruption / Anointment / Vessel of Souls in the same `FilterPanel` as search + Copy Link     |
  | Campaign map                  | search + Copy Link, the section tabs (scroll sideways on phones), Map \| List + the key hint  |
  | Loot filter library           | the Shared / My filters switch with the Shared tab's search + sort (`SharedFiltersToolbar`)   |
  | Loot filter editor            | the Rules / Styles / Settings / JSON / Test tab row (the title row and buttons stay above it) |

  A page whose tabs already sit in a `FilterPanel` (Enhance) puts them in that panel instead of a second card. The
  loot filter library's how-to text is a plain card (`rounded-xl border bg-card p-4 shadow-sm`), always shown. The
  library's Shared / My filters switch is a shadcn `Tabs` list whose active trigger is restyled to `bg-primary`; the
  campaign map's Map | List toggle uses `SUBTAB_ACTIVE` / `SUBTAB_INACTIVE` inside its bordered group.

### `FilterGroup`

```tsx
<FilterGroupHeader label="Item Types">
  <Button …>All</Button> <Button …>None</Button>
</FilterGroupHeader>
<FilterGroupList>
  <FilterGroup
    label="Weapons"
    checked={true | false | 'indeterminate'}
    onToggleGroup={…}
    options={[{ id: 'Axe', label: 'Axe', checked: true }, …]}
    onToggle={(id) => …}
  />
</FilterGroupList>
```

One labelled checkbox row, used by the runeword/gemword item types (`ItemTypeFilter`), the unique item categories
(`HtmCategoryFilter`) and the Bases item-type picker. The group label is `font-semibold` in the foreground colour (it
was dimmer than its items before). From `md` the label sits in a 10rem column with the options wrapping to its right;
on phones the label has its own line and the options wrap below it, indented under the label text. The component only
renders; selection semantics (what the group checkbox does, "nothing selected means all") stay with each caller.
`FilterGroupHeader` is the "Label: [All] [None]" row above a list of groups (also Mythicals' and Socketables'
"Categories:").

### `ResultsBar`

```tsx
<ResultsBar
  summary={`Showing ${String(n)} runewords`}
  chips={exactName !== null && <ExactNameChip … />}
  actions={isAuthenticated && <FavoritesToggleButton … />}
/>
```

The line between the panel and the results on every list page: muted `text-sm` summary, the exact-name chip right
after it, list toggles on the right. On Sets and Materials the exact-name chip moved here from the panel (the pills it
used to replace are hidden while it is set).

### `SectionHeader`

`title`, optional `icon`, `count` (muted, after the title), `id` (for `aria-labelledby`) and `action`. Used for the
Build detail sections and the Cube / Materials section headings instead of hand-rolled `h2 border-b`.

### Feature Components

Location: `src/features/[feature-name]/components/`

Feature-specific components that build on top of base components. These are not reusable across features.

## Theming

### Two Themes

1. **Dark (default)** - Primary theme, Diablo 2 inspired
2. **Light** - Warm, yellowish-brown tones (not pure white)

### CSS Variables Approach

shadcn/ui uses CSS variables for theming in `globals.css`:

```css
@layer base {
  :root {
    /* Light theme - warm/parchment tones */
    --background: 45 30% 94%;
    --foreground: 30 20% 15%;
    --primary: 35 80% 45%;
    /* ... */
  }

  .dark {
    /* Dark theme - Diablo 2 inspired */
    --background: 0 0% 8%;
    --foreground: 45 20% 85%;
    --primary: 35 100% 50%;
    /* ... */
  }
}
```

### Text Size

Four text size options (small, normal, large, extralarge = 14/16/18/20px, `TEXT_SIZE_MAP`) that adjust the base font size on `<html>`. Persisted to localStorage.

### Diablo Font

Optional toggle for thematic font rendering applied via a `.diablo-font` CSS class on `<html>`. Persisted to localStorage.

## Component Guidelines

### 1. Use the cn() utility for conditional classes

```tsx
import { cn } from '@/lib/utils';

function Button({ variant, className, ...props }) {
  return <button className={cn('base-styles', variant === 'primary' && 'primary-styles', className)} {...props} />;
}
```

### 2. Compose from base components

```tsx
import { Card, CardHeader, CardContent } from '@/components/ui/card';

function RunewordCard({ runeword }) {
  return (
    <Card>
      <CardHeader>{runeword.name}</CardHeader>
      <CardContent>{runeword.stats}</CardContent>
    </Card>
  );
}
```

### 3. Keep components focused

- Base components: Pure UI, no business logic
- Feature components: Feature-specific UI
- Screens: Data fetching + composition

### 4. Props over internal state

Prefer controlled components where the parent manages state.

## Accessibility

shadcn/ui components are built on Radix UI primitives, which provide:

- Keyboard navigation
- Focus management
- ARIA attributes
- Screen reader support

Maintain these features when customizing components.
