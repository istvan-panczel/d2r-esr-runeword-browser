# UI Components

## Component Organization

### Base Components (shadcn/ui)
Location: `src/components/ui/`

Foundational components installed via shadcn/ui CLI, styled with Tailwind CSS:

- `badge.tsx` - Status/category badges
- `button.tsx` - Buttons with variants
- `card.tsx` - Card containers
- `checkbox.tsx` - Checkbox inputs (Radix UI)
- `dialog.tsx` - Modal dialogs (Radix UI)
- `input.tsx` - Text inputs
- `input-group.tsx` - Input with clear button
- `label.tsx` - Form labels (Radix UI)
- `popover.tsx` - Popover overlays (Radix UI)
- `sheet.tsx` - Slide-out panels / mobile menu (Radix UI)
- `slider.tsx` - Range sliders (Radix UI)
- `spinner.tsx` - Loading spinner
- `textarea.tsx` - Multi-line text inputs

### Shared Components
Location: `src/components/`

Reusable components used across features:

- `CopyLinkButton.tsx` - Copy shareable URL to clipboard
- `CopyLinkHelpButton.tsx` - Help info for copy link
- `ScrollToTopButton.tsx` - Floating action button to scroll to top
- `SearchHelpButton.tsx` - Search syntax help (quoted phrases, AND logic)

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

Four text size options (sm, normal, lg, xl) that adjust the base font size on `<html>`. Persisted to localStorage.

### Diablo Font

Optional toggle for thematic font rendering applied via a `.diablo-font` CSS class on `<html>`. Persisted to localStorage.

## Component Guidelines

### 1. Use the cn() utility for conditional classes

```tsx
import { cn } from '@/lib/utils';

function Button({ variant, className, ...props }) {
  return (
    <button
      className={cn(
        'base-styles',
        variant === 'primary' && 'primary-styles',
        className
      )}
      {...props}
    />
  );
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
