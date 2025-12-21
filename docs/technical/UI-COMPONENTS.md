# UI Components

## Component Organization

### Base Components (shadcn/ui)
Location: `src/components/ui/`

These are the foundational components installed via shadcn/ui CLI. They are generic, reusable, and styled with Tailwind CSS.

```bash
# Install a component
npx shadcn@latest add button
npx shadcn@latest add card
npx shadcn@latest add input
# etc.
```

### Feature Components
Location: `src/features/[feature-name]/components/`

Feature-specific components that build on top of base components. These are not reusable across features.

```
features/runewords/components/
├── RunewordCard.tsx        # Uses Card from ui/
├── RunewordFilters.tsx     # Uses Select, Input from ui/
└── RuneDisplay.tsx         # Custom rune visualization
```

### Containers
Location: `src/features/[feature-name]/containers/`

Components that combine multiple UI components with data/logic. They connect to Redux store or use hooks.

```tsx
// RunewordListContainer.tsx
function RunewordListContainer() {
  const runewords = useLiveQuery(() => db.runewords.toArray());
  const filters = useAppSelector(selectFilters);

  return (
    <div>
      <RunewordFilters />
      <RunewordGrid runewords={filtered} />
    </div>
  );
}
```

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
    --background: 45 30% 94%;      /* Warm off-white */
    --foreground: 30 20% 15%;      /* Dark brown text */
    --primary: 35 80% 45%;         /* Gold */
    --secondary: 30 15% 85%;       /* Light tan */
    /* ... */
  }

  .dark {
    /* Dark theme - Diablo 2 inspired */
    --background: 0 0% 8%;         /* Near black */
    --foreground: 45 20% 85%;      /* Warm light text */
    --primary: 35 100% 50%;        /* Diablo gold */
    --secondary: 0 0% 15%;         /* Dark gray */
    /* ... */
  }
}
```

### Custom Diablo 2 Tokens

Consider adding game-specific color tokens:

```css
:root {
  /* Rune colors */
  --d2-rune-normal: 45 80% 50%;
  --d2-rune-high: 280 60% 50%;

  /* Item quality colors */
  --d2-quality-magic: 220 80% 60%;
  --d2-quality-rare: 55 100% 50%;
  --d2-quality-unique: 30 60% 45%;
  --d2-quality-set: 120 60% 40%;
  --d2-quality-runeword: 35 100% 50%;
}
```

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
// Good: Compose from shadcn/ui
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
- Containers: Data fetching + composition

### 4. Props over internal state

Prefer controlled components where the parent manages state.

## Accessibility

shadcn/ui components are built on Radix UI primitives, which provide:
- Keyboard navigation
- Focus management
- ARIA attributes
- Screen reader support

Maintain these features when customizing components.
