# Navigation & App Shell

Documentation for routing, layout, and navigation patterns.

## Routes

| Path | Screen | Description |
|------|--------|-------------|
| `/` | RunewordsScreen | Home page - browse and filter runewords |
| `/socketables` | SocketablesScreen | All socketables with category filters & search |
| `/runes` | RunesScreen | Browse runes (ESR/LoD/Kanji tabs) |
| `/gems` | GemsScreen | Browse all gems (8 types × 6 tiers) |
| `/crystals` | CrystalsScreen | Browse all crystals (12 types × 3 tiers) |

### Runes Sub-Navigation

The `/runes` page has internal tabs (not separate routes):
- **ESR Runes** (default) - I Rune → Null Rune, grouped by color/tier
- **LoD Runes** - El Rune → Zod Rune, sequential order
- **Kanji Runes** - Moon Rune → God Rune, all level 60

## App Shell Layout

The app uses a consistent shell layout with a header and main content area.

```
┌───────────────────────────────────────────────────────────────────────┐
│  D2R ESR    [Runewords] [Socketables] [Runes] [Gems] [Crystals]   [⚙]│
├───────────────────────────────────────────────────────────────────────┤
│                                                                       │
│                                                                       │
│                         Main Content Area                             │
│                        (Feature Screens)                              │
│                                                                       │
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘
```

### Header Components

- **Logo/Title**: "D2R ESR" or similar branding
- **Navigation Links**: Runewords, Socketables, Runes, Gems, Crystals
- **Settings Button**: Cog wheel icon (⚙) in top-right corner

### Navigation Style

- Active route highlighted in nav
- Mobile: Consider collapsible menu if needed

## Settings Drawer

The settings drawer opens from the right side when the cog icon is clicked.

```
┌─────────────────────────────────────────────────────────────┐
│  Header                                               [⚙]  │
├─────────────────────────────────┬───────────────────────────┤
│                                 │  Settings            [X]  │
│                                 │───────────────────────────│
│    Main Content                 │                           │
│    (dimmed/inactive)            │  Theme                    │
│                                 │  ○ Dark (default)         │
│                                 │  ○ Light                  │
│                                 │                           │
│                                 │───────────────────────────│
│                                 │  Data                     │
│                                 │  [Refresh Data]           │
│                                 │                           │
│                                 │  Version: 3.9.07          │
│                                 │  Last updated: 12/21/2025 │
└─────────────────────────────────┴───────────────────────────┘
```

### Drawer Behavior

- **Trigger**: Click settings cog icon
- **Position**: Slides in from right
- **Width**: Partial screen (~300-400px on desktop)
- **Overlay**: Main content dimmed but visible
- **Close**: X button or click outside

### Settings Contents

#### Theme Toggle
- Dark mode (default)
- Light mode
- Persisted in localStorage

#### Data Section
- **Refresh Data** button: Force re-fetch and parse all data
- **Version display**: Current ESR version from metadata
- **Last updated**: Timestamp of last successful parse

### Future Settings (TBD)
- View mode preferences (grid/list)
- Filter presets
- Export/import settings

## Implementation

### Router Setup

```typescript
// src/core/router/index.tsx
import { createBrowserRouter } from 'react-router-dom';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <RunewordsScreen /> },
      { path: 'socketables', element: <SocketablesScreen /> },
      { path: 'runes', element: <RunesScreen /> },
      { path: 'gems', element: <GemsScreen /> },
      { path: 'crystals', element: <CrystalsScreen /> },
    ],
  },
]);
```

### App Layout Component

```typescript
// src/core/layouts/AppLayout.tsx
export function AppLayout() {
  return (
    <div className="min-h-screen">
      <Header />
      <main className="container mx-auto">
        <Outlet />
      </main>
      <SettingsDrawer />
    </div>
  );
}
```

### Settings State

```typescript
interface SettingsState {
  theme: 'dark' | 'light';
  isDrawerOpen: boolean;
}
```

Theme is persisted to localStorage and applied to document root.

## Feature Location

```
src/core/
├── router/
│   └── index.tsx           # Route definitions
├── layouts/
│   └── AppLayout.tsx       # Main app shell
└── components/
    ├── Header.tsx          # Top navigation bar
    ├── NavLinks.tsx        # Navigation links
    └── SettingsDrawer.tsx  # Settings slide-out panel

src/features/settings/
├── store/
│   └── settingsSlice.ts    # Theme and settings state
├── hooks/
│   └── useTheme.ts         # Theme management hook
└── components/
    ├── ThemeToggle.tsx
    └── DataRefreshButton.tsx
```

## Theme Implementation

### CSS Variables

Use CSS custom properties for theming:

```css
:root {
  --background: 0 0% 100%;
  --foreground: 222.2 47.4% 11.2%;
  /* ... other variables */
}

.dark {
  --background: 222.2 84% 4.9%;
  --foreground: 210 40% 98%;
  /* ... other variables */
}
```

### Theme Toggle Logic

```typescript
function useTheme() {
  const theme = useSelector(selectTheme);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('theme', theme);
  }, [theme]);
}
```

## Accessibility

- Navigation links have proper `aria-current` for active state
- Settings drawer uses `aria-hidden` and focus trap when open
- Close button and Escape key close the drawer
- Proper heading hierarchy within drawer
