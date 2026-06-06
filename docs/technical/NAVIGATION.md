# Navigation & App Shell

Documentation for routing, layout, and navigation patterns.

## Routes

| Path | Screen | Description |
|------|--------|-------------|
| `/` | RunewordsScreen | Home page - browse and filter runewords |
| `/socketables` | SocketablesScreen | All socketables with category filters & search |
| `/uniques` | HtmUniqueItemsScreen | Unique items with category & coupon filters |

## App Shell Layout

```
┌───────────────────────────────────────────────────────────────────────┐
│  D2R ESR       [Runewords] [Socketables] [Uniques]               [⚙]│
├───────────────────────────────────────────────────────────────────────┤
│                                                                       │
│                         Main Content Area                             │
│                        (Feature Screens)                              │
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘
```

### Header Components

- **Logo/Title**: "D2R ESR" or similar branding
- **Navigation Links**: Runewords, Socketables, Uniques
- **Settings Button**: Cog icon in top-right corner

### Navigation Style

- Active route highlighted in nav
- Mobile: Sheet-based slide-out menu

## Settings Drawer

Opens from the right side when the cog icon is clicked.

```
┌─────────────────────────────────────────────────────────────┐
│  Header                                               [⚙]  │
├─────────────────────────────┬───────────────────────────────┤
│                             │  Settings            [X]      │
│                             │─────────────────────────────── │
│    Main Content             │  Theme                        │
│    (dimmed/inactive)        │  ○ Dark (default)             │
│                             │  ○ Light                      │
│                             │─────────────────────────────── │
│                             │  Text Size                    │
│                             │  [sm] [normal] [lg] [xl]      │
│                             │─────────────────────────────── │
│                             │  ☐ Diablo Font                │
│                             │─────────────────────────────── │
│                             │  Data                         │
│                             │  [Refresh Data]               │
│                             │                               │
│                             │  Version: 3.9.07              │
│                             │  Last updated: 12/21/2025     │
└─────────────────────────────┴───────────────────────────────┘
```

### Drawer Behavior

- **Trigger**: Click settings cog icon
- **Position**: Slides in from right
- **Overlay**: Main content dimmed but visible
- **Close**: X button or click outside

### Settings Contents

- **Theme Toggle**: Dark (default) / Light, persisted in localStorage
- **Text Size**: sm / normal / lg / xl, persisted in localStorage
- **Diablo Font**: Toggle for thematic font rendering, persisted in localStorage
- **Refresh Data**: Force re-fetch and parse all data
- **Version display**: Current ESR version from metadata
- **Last updated**: Timestamp of last successful parse

## Implementation

### Router Setup

```typescript
// src/core/router/index.tsx
const RunewordsScreen = lazy(async () => {
  const module = await import('@/features/runewords');
  return { default: module.RunewordsScreen };
});
// ... one lazy() wrapper per screen

function routeElement(Screen: LazyExoticComponent<ComponentType>) {
  return (
    <Suspense fallback={routeLoadingFallback}>
      <Screen />
    </Suspense>
  );
}

export const router = createBrowserRouter(
  [
    {
      path: '/',
      element: <AppLayout />,
      children: [
        { index: true, element: routeElement(RunewordsScreen) },
        { path: 'socketables', element: routeElement(SocketablesScreen) },
        { path: 'uniques', element: routeElement(HtmUniqueItemsScreen) },
      ],
    },
  ],
  {
    basename: import.meta.env.BASE_URL,
  }
);
```

Uses `createBrowserRouter` (not hash-based) with `basename` set from Vite's `BASE_URL` for GitHub Pages compatibility.

**Code splitting**: Every route screen is lazy-loaded with `React.lazy()` + `<Suspense>` so each screen lands in its own chunk instead of the entry bundle. The guard test `src/core/router/routeCodeSplitting.test.ts` fails if a screen is ever statically imported into the router again.

### Settings State

```typescript
interface SettingsState {
  readonly theme: Theme;           // 'dark' | 'light'
  readonly textSize: TextSize;     // 'sm' | 'normal' | 'lg' | 'xl'
  readonly useDiabloFont: boolean;
  readonly isDrawerOpen: boolean;
}
```

All settings (except `isDrawerOpen`) are persisted to localStorage and restored on startup.

## Feature Location

```
src/core/
├── router/
│   └── index.tsx           # Route definitions
├── layouts/
│   └── AppLayout.tsx       # Main app shell
└── components/
    ├── Header.tsx          # Top navigation bar
    └── SettingsDrawer.tsx  # Settings slide-out panel

src/features/settings/
├── components/
│   └── ThemeInitializer.tsx  # Apply theme on initial render
├── constants/
│   ├── textSize.ts           # Text size pixel mappings
│   └── types.ts              # Theme, TextSize types
├── hooks/
│   └── useTheme.ts           # Theme toggle hook
└── store/
    └── settingsSlice.ts      # Theme, text size, font, drawer state
```

## Accessibility

- Navigation links have proper `aria-current` for active state
- Settings drawer uses `aria-hidden` and focus trap when open
- Close button and Escape key close the drawer
