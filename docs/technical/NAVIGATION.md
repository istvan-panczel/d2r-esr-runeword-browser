# Navigation & App Shell

Documentation for routing, layout, and navigation patterns.

## Routes

| Path | Screen | Description |
|------|--------|-------------|
| `/` | RunewordsScreen | Home page - browse and filter runewords |
| `/socketables` | SocketablesScreen | All socketables with category filters & search |

## App Shell Layout

```
┌───────────────────────────────────────────────────────────────────────┐
│  D2R ESR             [Runewords] [Socketables]                     [⚙]│
├───────────────────────────────────────────────────────────────────────┤
│                                                                       │
│                         Main Content Area                             │
│                        (Feature Screens)                              │
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘
```

### Header Components

- **Logo/Title**: "D2R ESR" or similar branding
- **Navigation Links**: Runewords, Socketables
- **Settings Button**: Cog icon (⚙) in top-right corner

### Navigation Style

- Active route highlighted in nav
- Mobile: Consider collapsible menu if needed

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
│                             │  Data                         │
│                             │  [Refresh Data]               │
│                             │                               │
│                             │  Version: 3.9.07              │
│                             │  Last updated: 12/21/2025     │
└─────────────────────────────┴───────────────────────────────┘
```

### Drawer Behavior

- **Trigger**: Click settings cog icon
- **Position**: Slides in from right (~300-400px on desktop)
- **Overlay**: Main content dimmed but visible
- **Close**: X button or click outside

### Settings Contents

- **Theme Toggle**: Dark (default) / Light, persisted in localStorage
- **Refresh Data**: Force re-fetch and parse all data
- **Version display**: Current ESR version from metadata
- **Last updated**: Timestamp of last successful parse

## Implementation

### Router Setup

```typescript
// src/core/router/index.tsx
export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <RunewordsScreen /> },
      { path: 'socketables', element: <SocketablesScreen /> },
    ],
  },
]);
```

### Settings State

```typescript
interface SettingsState {
  theme: 'dark' | 'light';
  isDrawerOpen: boolean;
}
```

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
└── store/
    └── settingsSlice.ts    # Theme and settings state
```

## Accessibility

- Navigation links have proper `aria-current` for active state
- Settings drawer uses `aria-hidden` and focus trap when open
- Close button and Escape key close the drawer
