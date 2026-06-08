# Feature: Build Sharing with Supabase Backend

## Overview

Add a backend-powered "save and share your build" feature to the existing client-side-only React Vite app. The app currently displays Diablo 2 Resurrected mod items (unique items and runewords) with filters and search. This feature lets users create builds, save them, share them publicly, and like other users' builds.

## Technology Choice

**Primary: Supabase (BaaS)**

Supabase was chosen because:

- Free tier covers the expected scale (~100-200 users, ~10 builds per user)
- Built-in auth, PostgreSQL database, auto-generated APIs, Row Level Security
- No need to build or host a separate backend server (no Express/NestJS)
- The client SDK (`@supabase/supabase-js`) integrates directly into the existing React Vite app
- Data is portable — standard PostgreSQL under the hood, no vendor lock-in

### Supabase Free Tier Limits

- 500 MB database storage
- 50,000 monthly active users for auth
- 1 GB file storage
- 2 GB database egress
- 500,000 edge function invocations/month
- **Pausing behavior:** Free tier projects pause after 7 days of inactivity. When a paused project receives a request, Supabase auto-resumes it in ~1-2 minutes. No data is lost during a pause. The first user after inactivity experiences a slow load while Supabase wakes up, then everything works normally. This is acceptable for a niche app with a small userbase. No keep-alive cron needed for v1.

## State Management Architecture

The builds feature follows the existing codebase patterns: **Redux slices + Redux Saga** for all state management.

### Slices & Sagas

- **Auth slice + saga**: Watches Supabase `onAuthStateChange`, stores user/session/profile state globally. Handles login, logout, profile updates.
- **Builds slice + saga**: Handles builds listing, CRUD operations, pagination state, filters, and search.
- **Likes**: Part of the builds slice — stores liked state per build with optimistic updates on toggle.

### HTTP Client

Native `fetch()` via the `@supabase/supabase-js` SDK. The app does not use axios or any other HTTP library. No interceptors.

### Why Not React Query / TanStack Query

Not needed at this scale. Adding it would introduce a second state management paradigm alongside Redux. All Supabase interactions go through sagas, keeping the architecture consistent.

### Saga Patterns (from existing codebase)

- **Action chains**: `fetchBuilds` → `fetchBuildsSuccess` → UI update (same pattern as the data-sync pipeline)
- **Error handling**: `fetchBuildsFailure` with error state in the slice
- **Parallel operations**: `all()` where applicable (e.g., fetching build + checking like status)

## Authentication

### Providers

1. **Discord OAuth (primary)** — Most users in the mod community have Discord. One-click sign-in, lowest friction.
2. **Email magic link (secondary)** — For users without Discord. No password management or reset flows needed.

### Auth Flow

1. User clicks "Sign in with Discord" (or enters email for magic link)
2. Supabase handles the OAuth/magic link flow, token management, and session persistence
3. On first login, a database trigger auto-creates a `profiles` row
   - For Discord users: pre-fill `display_name` from their Discord username
   - For magic link users: default to a placeholder like "Adventurer"
   - A random 4-digit discriminator (1000-9999) is assigned automatically
4. **Post-registration consent gate** (first login only, detected by `privacy_policy_accepted_at IS NULL`):
   - After OAuth redirect completes, user is authenticated but cannot access build features until accepting the privacy policy
   - A consent gate screen is shown with:
     - Privacy policy link + unchecked acceptance checkbox (GDPR requires active consent — must not be pre-checked)
     - Profile setup: confirm or change display name
     - "Continue" button (disabled until checkbox is checked)
   - On acceptance: `privacy_policy_accepted_at` timestamp is set, user proceeds to their intended destination
5. Subsequent logins skip the consent gate entirely and return to the page the user was on before clicking Sign In
6. **Post-auth redirect**: Before initiating the OAuth/magic link flow, the app stores the current URL (or intended destination) in `sessionStorage`. After auth completes and the consent gate (if needed) is passed, the app navigates back to that stored URL. This way, a user clicking "Sign In" from `/builds/new` returns to `/builds/new` after login.
7. Email addresses are never exposed publicly — only `display_name#discriminator` from the `profiles` table is visible to other users

### Sign-In UI

Clicking the "Sign In" button opens a **Dialog modal** (centered overlay using the existing Dialog component) with:
- **"Sign in with Discord"** button (primary, prominent)
- Separator: "or"
- **Email input** + **"Send magic link"** button

The dialog closes on successful auth initiation (Discord redirects away; magic link shows a "Check your email" confirmation).

**Auth errors** (Discord denied/cancelled, magic link expired, session refresh failure): Show a **toast notification** (Sonner) with the error message (e.g., "Sign-in was cancelled", "Magic link expired — please try again"). User stays on the current page and can retry by reopening the Sign In dialog.

### Consent Gate

After first login, a **full-page modal overlay** is rendered (non-dismissible, covers the entire viewport). It cannot be closed — the user must accept to proceed.

The overlay contains:
- Privacy policy link + unchecked acceptance checkbox
- Display name field (pre-filled from Discord username or "Adventurer")
- "Continue" button (disabled until checkbox is checked)

**Implementation:** The auth saga detects `privacy_policy_accepted_at IS NULL` after login, sets a `needsConsent` flag in Redux. A top-level component renders the full-page overlay when this flag is true, blocking all other interaction. On acceptance, the saga updates the profile and clears the flag.

### Auth Code (Reference)

```ts
// Discord login
const { error } = await supabase.auth.signInWithOAuth({
  provider: 'discord'
})

// Magic link login
const { error } = await supabase.auth.signInWithOtp({
  email: userEmail
})
```

## Navigation & Header

### Desktop

The header navigation adds "Builds" as the last content item (after the existing Ascendancies link):

```
[Runewords] [Socketables] [Uniques] [Mythicals] [Ascendancies] [Builds]  ...  [Sign In] [Settings]
```

- **Signed out**: "Sign In" button appears next to the Settings gear icon
- **Signed in**: "Sign In" is replaced by the user's **avatar + DisplayName#1234** as a dropdown button

### User Dropdown Menu (when signed in)

- **My Builds** — navigates to `/builds` with "My Builds" filter active
- **Profile** — navigates to `/user/:currentUserId`
- **Sign Out**

### Mobile

Sign In button and user dropdown appear in the hamburger menu sheet, alongside the existing nav items.

## Authentication Prompts

When a logged-out user interacts with authenticated-only features:

- **Clicking Like**: An inline popover/tooltip appears on the like button: "Sign in to like builds" with a sign-in link
- **Clicking Create Build**: An inline popover/tooltip appears: "Sign in to create builds" with a sign-in link

No modal dialogs or page redirects — keep prompts lightweight and non-disruptive.

## Data Model

### Tables

#### `profiles`

| Column                     | Type      | Notes                                                                     |
| -------------------------- | --------- | ------------------------------------------------------------------------- |
| id                         | uuid (PK) | FK → `auth.users.id` with `ON DELETE CASCADE`                             |
| display_name               | text      | Chosen by user, visible publicly                                          |
| discriminator              | smallint  | Random 1000-9999, NOT NULL, DEFAULT `floor(random() * 9000 + 1000)::smallint`. On collision during display name change, retry with a new random value (max 10 attempts). |
| avatar_url                 | text      | Optional, from Discord metadata                                           |
| privacy_policy_accepted_at | timestamp | Set on first consent, required to use build features                      |
| created_at                 | timestamp | Default `now()`                                                           |
| updated_at                 | timestamp | Auto-updated                                                              |

**Constraints:**
- `UNIQUE(display_name, discriminator)` — prevents true duplicates while allowing same display names with different discriminators
- Display format everywhere: `Name#1234` (always visible, like old Discord style)
- On display name change, a new discriminator is generated. If the `(new_name, new_discriminator)` pair collides with an existing one, retry with a new random discriminator (up to 10 attempts before returning an error)
- `updated_at` is auto-set on every row update via a PostgreSQL trigger (using `moddatetime` extension or a custom trigger)

#### `builds`

| Column              | Type      | Notes                                                         |
| ------------------- | --------- | ------------------------------------------------------------- |
| id                  | uuid (PK) | Auto-generated                                                |
| user_id             | uuid (FK) | References `profiles.id`                                      |
| name                | text      | Build name (e.g., "Hammerdin MF")                             |
| description         | text      | Optional notes/guide                                          |
| class               | text      | Character class                                               |
| build_data          | jsonb     | The actual build: item references with snapshots (see below)  |
| esr_version         | text      | ESR version when the build was first created. Never changes.  |
| esr_version_updated | text      | ESR version when last edited. Null if never edited.           |
| likes_count         | integer   | Default `0`, updated via trigger                              |
| created_at          | timestamp | Default `now()`                                               |
| updated_at          | timestamp | Auto-updated via trigger (same as profiles)                   |

**Constraints:**
- `builds.user_id` → `profiles.id` with `ON DELETE CASCADE` (deleting a profile cascades to all their builds)
- `updated_at` auto-set on every row update via trigger

All builds are public. There is no private/draft state.

#### `likes`

| Column   | Type      | Notes                                                        |
| -------- | --------- | ------------------------------------------------------------ |
| build_id | uuid (FK) | References `builds.id` with `ON DELETE CASCADE`              |
| user_id  | uuid (FK) | References `profiles.id` with `ON DELETE CASCADE`            |

**Constraints:**
- `PRIMARY KEY (build_id, user_id)` — composite PK, enforces one like per user per build
- Cascading deletes: deleting a build removes all its likes; deleting a profile removes all their likes

### `build_data` JSONB Structure

The database stores **typed item references** with full item snapshots. Each equipment slot is either a structured reference or `null` (empty slot).

#### Item Reference Types

There are five types of item references:

**Unique item** — references a unique item from `htmUniqueItems` by its auto-increment ID, includes a full snapshot of the item's stats at the time the build was created/edited:
```json
{
  "type": "unique",
  "id": 42,
  "snapshot": {
    "name": "Harlequin Crest",
    "baseItem": "Shako",
    "category": "Helm",
    "reqLevel": 62,
    "properties": ["+2 to All Skill Levels", "+1-148 to Life (+1.5 per Character Level)", "..."]
  }
}
```

Snapshot fields for uniques: `name`, `baseItem`, `category`, `reqLevel`, `properties` (stored as strings — the `rawText` values from `Affix` objects where applicable). Other `htmUniqueItems` fields (`baseItemCode`, `itemLevel`, `isAncientCoupon`, `gambleItem`) are not included — they're not useful for display on a build page.

**Mythical unique** — references a mythical unique item from `mythicalUniques` by its ID, includes a snapshot:
```json
{
  "type": "mythical",
  "id": 7,
  "snapshot": {
    "name": "Tyrael's Might",
    "baseItem": "Sacred Armor",
    "category": "Body Armor",
    "reqLevel": 84,
    "properties": ["+2 to All Skills", "+150% Enhanced Defense", "..."]
  }
}
```

Snapshot fields for mythicals: `name`, `baseItem`, `category`, `reqLevel`, `properties` (matching the unique snapshot structure for consistent display).

**Runeword** — references a runeword by its compound key (`name` + `variant`), includes a full snapshot:
```json
{
  "type": "runeword",
  "name": "Enigma",
  "variant": 1,
  "snapshot": {
    "sockets": 3,
    "runes": ["Jah", "Ith", "Ber"],
    "gems": [],
    "allowedItems": ["Body Armor"],
    "columnAffixes": {
      "weaponsGloves": ["+2 to All Skills", "+45% Faster Run/Walk", "..."],
      "helmsBoots": ["+2 to All Skills", "+45% Faster Run/Walk", "..."],
      "armorShieldsBelts": ["+2 to All Skills", "+45% Faster Run/Walk", "+1 to Teleport", "..."]
    },
    "reqLevel": 65
  }
}
```

Snapshot stores all three bonus columns from `columnAffixes`. Each column's affixes are stored as `rawText` strings extracted from the `Affix` objects. The display logic picks the correct column based on which equipment slot the runeword occupies (e.g., armor slot → `armorShieldsBelts`). Storing all three columns ensures snapshots survive slot changes during edits.

**Gemword** — references a gemword by its compound key (`name` + `variant`), includes a full snapshot. Gemwords were added to the app (post-initial-design) and behave like runewords but use gems instead of runes:
```json
{
  "type": "gemword",
  "name": "Glow",
  "variant": 1,
  "snapshot": {
    "sockets": 2,
    "gems": ["Perfect Ruby", "Perfect Ruby"],
    "allowedItems": ["Helm"],
    "columnAffixes": {
      "weaponsGloves": ["..."],
      "helmsBoots": ["..."],
      "armorShieldsBelts": ["..."]
    },
    "reqLevel": 20
  }
}
```

Gemword snapshots store all three bonus columns (same as runewords) as `rawText` strings; the display picks the column for the equipment slot. Gemwords have no `runes` field — the recipe is in `gems`.

**Freetext** — user-typed name for items not in the database (rares, crafted, magic items). No snapshot:
```json
{
  "type": "freetext",
  "name": "GG rare crafted gloves"
}
```

#### Full `build_data` Example

```json
{
  "items": {
    "helmet": { "type": "unique", "id": 42, "snapshot": { "name": "Harlequin Crest", "baseItem": "Shako", "properties": ["..."] } },
    "armor": { "type": "runeword", "name": "Enigma", "variant": 1, "snapshot": { "runes": ["Jah", "Ith", "Ber"], "columnAffixes": { "weaponsGloves": ["..."], "helmsBoots": ["..."], "armorShieldsBelts": ["..."] } } },
    "weapon": { "type": "unique", "id": 105, "snapshot": { "name": "Grief", "baseItem": "Phase Blade", "properties": ["..."] } },
    "shield": { "type": "unique", "id": 78, "snapshot": { "name": "Herald of Zakarum", "properties": ["..."] } },
    "gloves": { "type": "freetext", "name": "3/20 rare java gloves" },
    "boots": { "type": "unique", "id": 91, "snapshot": { "name": "War Traveler", "properties": ["..."] } },
    "belt": { "type": "unique", "id": 63, "snapshot": { "name": "Arachnid Mesh", "properties": ["..."] } },
    "amulet": { "type": "unique", "id": 200, "snapshot": { "name": "Mara's Kaleidoscope", "properties": ["..."] } },
    "ring1": { "type": "unique", "id": 210, "snapshot": { "name": "Stone of Jordan", "properties": ["..."] } },
    "ring2": { "type": "unique", "id": 215, "snapshot": { "name": "Bul-Kathos' Wedding Band", "properties": ["..."] } }
  },
  "weaponSwap": {
    "weapon2": { "type": "runeword", "name": "Call to Arms", "variant": 1, "snapshot": { "runes": ["..."], "columnAffixes": { "weaponsGloves": ["..."], "helmsBoots": ["..."], "armorShieldsBelts": ["..."] } } },
    "shield2": { "type": "runeword", "name": "Spirit", "variant": 1, "snapshot": { "runes": ["..."], "columnAffixes": { "weaponsGloves": ["..."], "helmsBoots": ["..."], "armorShieldsBelts": ["..."] } } }
  },
  "mercenary": {
    "helmet": { "type": "unique", "id": 150, "snapshot": { "name": "Andariel's Visage", "properties": ["..."] } },
    "armor": { "type": "runeword", "name": "Fortitude", "variant": 1, "snapshot": { "runes": ["..."], "columnAffixes": { "weaponsGloves": ["..."], "helmsBoots": ["..."], "armorShieldsBelts": ["..."] } } },
    "weapon": { "type": "runeword", "name": "Infinity", "variant": 1, "snapshot": { "runes": ["..."], "columnAffixes": { "weaponsGloves": ["..."], "helmsBoots": ["..."], "armorShieldsBelts": ["..."] } } },
    "shield": null,
    "gloves": null,
    "boots": null,
    "belt": null,
    "amulet": null,
    "ring1": null,
    "ring2": null
  },
  "charms": ["Annihilus", "Hellfire Torch", "9x Paladin Combat GCs", "Gheed's Fortune"],
  "ascendancy": "Battlemage",
  "skills": "20 Blessed Hammer, 20 Vigor, 20 Blessed Aim, 20 Concentration, 1pt Holy Shield, rest into Holy Bolt"
}
```

**Slot summary:**
- **Player gear**: 10 slots (helmet, armor, weapon, shield, gloves, boots, belt, amulet, ring1, ring2)
- **Weapon swap**: 2 slots (weapon2, shield2)
- **Mercenary gear**: 10 slots (same as player — ESR gives mercs full equipment)
- **Charms**: Named list (array of strings, user adds as many as needed)
- **Ascendancy**: Single ascendancy name (optional)
- **Skills**: Freetext description of skill allocation (optional)

**Size estimate:** Each build is ~20-50 KB with full snapshots for all 22 equipment slots. Well within Supabase free tier limits.

### Database Trigger: Auto-Create Profile on Signup

```sql
create function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, display_name, discriminator, avatar_url)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'user_name',
      'Adventurer'
    ),
    floor(random() * 9000 + 1000)::smallint,
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
```

Note: `avatar_url` is extracted from Discord OAuth metadata. For email magic link users, this will be `null` (no avatar).

### Database Trigger: Auto-Update `likes_count`

A Postgres trigger on the `likes` table increments/decrements `builds.likes_count` on insert/delete. This avoids counting likes on every read query.

```sql
create function public.handle_likes_change()
returns trigger as $$
begin
  if (TG_OP = 'INSERT') then
    update builds set likes_count = likes_count + 1 where id = NEW.build_id;
    return NEW;
  elsif (TG_OP = 'DELETE') then
    update builds set likes_count = likes_count - 1 where id = OLD.build_id;
    return OLD;
  end if;
end;
$$ language plpgsql security definer;

create trigger on_like_changed
  after insert or delete on likes
  for each row execute function handle_likes_change();
```

## Row Level Security (RLS) Policies

### `profiles`

- **SELECT:** Anyone can read any profile (public display names)
- **UPDATE:** Users can only update their own profile (`auth.uid() = id`)

### `builds`

- **SELECT:** Anyone can read any build (all builds are public)
- **INSERT:** Authenticated users can insert builds with their own `user_id`
- **UPDATE:** Users can only update their own builds (`auth.uid() = user_id`)
- **DELETE:** Users can only delete their own builds (`auth.uid() = user_id`)

### `likes`

- **SELECT:** Anyone can read likes (needed for displaying like counts and liked state)
- **INSERT:** Authenticated users can insert a like with their own `user_id`
- **DELETE:** Users can only delete their own likes (`auth.uid() = user_id`)

## Key Queries

### Browse Builds (Newest)

```sql
select
  b.*,
  p.display_name,
  p.discriminator,
  p.avatar_url
from builds b
join profiles p on p.id = b.user_id
order by b.created_at desc, b.id desc;
```

### Browse Builds (Most Liked)

```sql
select
  b.*,
  p.display_name,
  p.discriminator,
  p.avatar_url
from builds b
join profiles p on p.id = b.user_id
order by b.likes_count desc, b.created_at desc, b.id desc;
```

### Check if Current User Liked a Build

```sql
select exists(
  select 1 from likes
  where build_id = :build_id and user_id = auth.uid()
);
```

## Character Classes

The standard 7 Diablo 2 Resurrected classes:

- Amazon
- Necromancer
- Barbarian
- Sorceress
- Paladin
- Druid
- Assassin

Each class can have an ascendancy (see below).

## Ascendancies in Builds

ESR adds an ascendancy system where characters earn a special item granting tiered bonuses. The ascendancy feature is already implemented in the app (v1.9.0) — 15 ascendancies are parsed from `easternsunresurrected.com/ascendancies.htm`, stored in IndexedDB, and displayed on the `/ascendancies` page.

For the builds feature, ascendancies are used as follows:

- **Build form**: A simple dropdown of all 15 ascendancy names (optional field). The dropdown is NOT filtered by class selection — all ascendancies are available to all classes.
- **Build detail page**: Shows the ascendancy name along with its tier bonuses (pulled from the viewer's local parsed data). All 5 tiers are shown — the build does not store which tier the character has reached.
- **Build data**: Stores only the ascendancy name string (e.g., `"ascendancy": "Battlemage"`). No tier data stored.

Complete list: Battlemage, Blademaster, Arcanist, Bloodmage, Awakened, Ironbolt, Starborn, Lifebreaker, Worldshaper, Soul Warden, Stance Dancer, Nomad, Sharpshooter, Mana Warden, Berserker.

## Screens & Routes

### New Routes

| Route                    | Screen                        | Access                                                        |
| ------------------------ | ----------------------------- | ------------------------------------------------------------- |
| `/builds`                | Builds listing / browse screen | Public (anyone can browse)                                   |
| `/builds/new`            | Build creation form           | Authenticated only (redirects to `/builds` if not logged in)  |
| `/builds/:buildId/edit`  | Build editing form            | Authenticated, owner only (redirects to `/builds` if not)     |
| `/build/:buildId`        | Individual build detail page  | Public                                                        |
| `/user/:userId`          | Author profile page           | Public                                                        |

### Auth-Protected Route Behavior

Unauthenticated users navigating directly to `/builds/new` or `/builds/:buildId/edit` are **redirected to `/builds`**. No error message — just a silent redirect.

### Existing Routes (unchanged)

| Route | Screen |
| ----- | ------ |
| `/` | Runewords browser (home) |
| `/socketables` | Socketables browser |
| `/uniques` | Unique items browser |
| `/mythicals` | Mythical uniques browser |
| `/ascendancies` | Ascendancies browser |

## Builds Listing Screen (`/builds`)

The primary screen for discovering community builds.

### Layout

```
[+ Create Build]    [Search...] [Class v] [Sort v]
[My Builds toggle]

--- Build Cards (infinite scroll) ---
```

Single flat list of build cards. Filters and sorting controls at the top. A prominent **"+ Create Build"** button at the top of the filters area.

### Build Card

Minimal card design — optimized for scanning:

```
+----------------------------------------------+
| Hammerdin MF              [14 likes]         |
| Paladin     by RuneMaster#4316              |
| Mar 3, 2026               [ESR 3.9.07]      |
+----------------------------------------------+
```

Each card shows:
- Build name
- Character class
- Small author avatar (20-24px) + display name with discriminator (clickable, links to `/user/:userId`)
- Like count
- Created date
- ESR version badge (visually distinct if it differs from the viewer's current ESR version)

No item preview on cards — keep them lightweight.

### Filtering & Sorting

- **Search**: By build name — **server-side** using Supabase `ilike` query (text input)
- **Filter**: By character class (dropdown or chips)
- **Sort**: Newest first (default) or Most liked
- **My Builds toggle**: When logged in, a toggle to switch between "All Builds" and "My Builds". Filters to show only builds authored by the current user. **Not included in shareable URLs** — this is local-only state (sharing a "My Builds" URL would show the recipient's builds, not yours).

No ascendancy filter — keep it simple.

### Pagination

**Cursor-based pagination** with 50 builds per batch. Load more as the user scrolls down (infinite scroll). Cursor-based pagination is used instead of offset-based to avoid missed or duplicated items when `likes_count` changes between page fetches.

**Cursor strategy per sort mode:**
- **Newest first**: Cursor is `(created_at, id)` — both are immutable, so ordering is stable
- **Most liked**: Cursor is `(likes_count, created_at, id)` — `likes_count` can change between fetches, but the triple cursor minimizes duplicates. Acceptable trade-off for v1.

### Empty State

When no builds exist: encouraging message with icon — "No builds yet. Be the first to share a build!" — with a prominent Create Build button.

When filters return no matches: simple "No builds match your filters." message.

### Access

- Unauthenticated users can browse and view all builds
- Login is required only to create, edit, or like builds

## Build Detail Page (`/build/:buildId`)

The shareable page for a single build. The URL itself (`/build/:buildId`) is the share link.

### Content

- **Header**: Build name, character class, author display name with discriminator (links to `/user/:userId`), created/updated date
- **Description**: Optional freetext notes/guide from the author
- **Player Gear**: Equipment grid (see layout below)
- **Weapon Swap**: Secondary weapon and shield
- **Mercenary Gear**: Same equipment grid layout
- **Charms**: List of charm names
- **Ascendancy**: Ascendancy name with its tier bonuses displayed (from the viewer's local parsed data)
- **Skills**: Freetext skill allocation description

### Equipment Grid Layout

Equipment slots are displayed in a visual grid mimicking D2's character equipment screen:

```
        [Helmet]
[Weapon] [Armor]  [Shield]
[Gloves] [Belt]   [Boots]
[Ring 1] [Amulet] [Ring 2]

--- Weapon Swap ---
[Weapon 2] [Shield 2]

--- Mercenary ---
        [Helmet]
[Weapon] [Armor]  [Shield]
[Gloves] [Belt]   [Boots]
[Ring 1] [Amulet] [Ring 2]
```

- **Empty slots**: Always shown in the grid with a placeholder (e.g., "---"). Keeps layout consistent and shows what's intentionally unequipped.
- **Item stats**: Each filled slot shows the item name and its bonuses (runeword bonuses, unique item stats — same depth as existing runewords/uniques screens). No individual rune bonus breakdown for runewords.
- **Freetext items**: Display just the typed name (no stats to look up).

### ESR Version Diff on Items

When viewing a build, item stats are displayed using the **current data** from the viewer's local database (their current ESR version). If the stored snapshot from the build's creation/edit time differs from the current data:

1. **Default view**: Shows the item's **current stats** from the viewer's local DB
2. **Change detected**: A **warning badge** appears on that equipment slot indicating stats may have changed since the build was created
3. **Tap/click badge**: Reveals the **original snapshot stats** from when the build author created or last edited the build
4. **Item not found**: If the referenced item no longer exists in the viewer's current data (removed or renamed in a newer ESR version), fall back to displaying the snapshot data with a note: "This item may no longer exist in the current ESR version"

### Mobile Responsive

On small screens (below `md` breakpoint), the equipment grid stacks to a **vertical list** of slot cards. The grid layout is used on tablet and larger screens.

### Interactions

- **Like button**: Requires login. Toggles like/unlike. Shows current like count. Logged-out users see an inline popover prompting sign-in.
- **Share**: The page URL is the share link. A copy-link button for convenience.
- **Edit / Delete**: Visible only to the build's author. Edit navigates to `/builds/:buildId/edit`. Delete requires confirmation.

## Build Creation & Editing

### Routes

- **Create**: `/builds/new` — dedicated full page
- **Edit**: `/builds/:buildId/edit` — same form, pre-filled with existing build data

### Item Selection

Each equipment slot uses an **inline autocomplete** picker. Clicking a slot turns it into a search input. The user types to search the app's existing local item database (**unique items**, **mythical uniques**, **runewords**, and **gemwords**). If the desired item isn't found, the user can type a custom name for rares, crafted, or magic items (stored as freetext).

**Autocomplete result presentation:** Results are **grouped by type** using `cmdk` Command component's native group support. Four sections appear in order:
1. **Unique Items** — from `htmUniqueItems`
2. **Mythical Uniques** — from `mythicalUniques`
3. **Runewords** — from `runewords`
4. **Gemwords** — from `gemwords`

Only groups with matches are shown. Empty groups are hidden.

**Runeword variant display:** Runewords with multiple variants show their full `allowedItems` list in parentheses to distinguish them:
- `Grief (Phase Blade, Berserker Axe)` vs `Grief (Sword, Axe)`
- `Spirit (Sword)` vs `Spirit (Shield)`

```
        [Helmet: Shako    ]
[Weapon: |gri|                          ] [Shield: HoZ]
         |--- Unique Items -------------|
         |   Griswold's Edge            |
         |--- Runewords ----------------|
         |   Grief (Phase Blade, ...)   |
         |   Grief (Sword, Axe)         |
[Gloves] [Belt]   [Boots]
[Ring 1] [Amulet] [Ring 2]
```

When a user selects an item from the autocomplete:
- **Unique item**: The reference stores the item's `id` (auto-increment PK from `htmUniqueItems`) and a full snapshot of its current stats
- **Mythical unique**: The reference stores the item's `id` (from `mythicalUniques`) and a full snapshot — same display structure as regular uniques
- **Runeword**: The reference stores the runeword's `name` and `variant` (compound key) and a full snapshot of its current stats
- **Gemword**: The reference stores the gemword's `name` and `variant` (compound key) and a full snapshot — same structure as runewords, with a `gems` recipe instead of `runes`
- **Freetext**: If the user's input doesn't match any item, it's stored as a freetext entry with just the typed name

### Form Layout

All sections visible on one scrollable page (no wizard, no collapsible sections):

1. **Basic Info**
   - Build name (required)
   - Description / notes (optional, freetext)
   - Character class (required, dropdown)

2. **Player Gear** — Equipment grid with 10 inline autocomplete slot pickers (same grid layout as the detail page)

3. **Weapon Swap** — 2 slots (weapon2, shield2) with inline pickers

4. **Mercenary Gear** — Equipment grid with 10 slots (same UI as player gear)

5. **Charms** — Named list. User adds charm entries one at a time (e.g., "Annihilus", "9x Java GCs"). Free-form text per entry. "+ Add charm" button.

6. **Ascendancy** — Dropdown of all 15 available ascendancies (optional). Not filtered by class selection.

7. **Skills** — Freetext area for describing skill allocation

### Save

Single **"Save Build"** button. The build goes live immediately — no draft state. All builds are public. Empty builds (name + class only, no items) are allowed — since there's no draft state, this lets users save placeholders to fill in later.

**Save failure:** If the save request fails (network error, Supabase paused), show an error toast and keep the form open with all data intact. Do not clear or navigate away.

On save, the app automatically:
- Sets `esr_version` to the current ESR version from local IndexedDB metadata (on create)
- Sets `esr_version_updated` to the current ESR version (on edit)
- Captures full item snapshots for all referenced items (unique/mythical/runeword) at the current point in time

### Expected Scale

~100-200 users, ~10 builds per user. No per-user build limit is enforced. Limits can be added later if needed.

### Editing

- Users can edit their own builds at any time
- Editing updates the existing record in place (no versioning or edit history)
- Item snapshots are refreshed on each edit to reflect the current ESR data

### Unsaved Changes

Browser `beforeunload` prompt when navigating away from the create/edit form with unsaved data: "You have unsaved changes. Are you sure you want to leave?"

### Deletion

- Users can delete their own builds
- Requires confirmation before deletion

## Validation & Sanitization

### Field Limits

| Field | Required | Min | Max |
|-------|----------|-----|-----|
| Build name | Yes | 1 | 100 characters |
| Description | No | — | 2000 characters |
| Skills freetext | No | — | 2000 characters |
| Charm entry | Yes (per entry) | 1 | 100 characters |
| Display name | Yes | 1 | 50 characters |

### Display Name Validation

- Any characters allowed (including Unicode)
- Leading and trailing whitespace is trimmed
- Whitespace-only names are rejected
- Max 50 characters
- Paired with a 4-digit discriminator (1000-9999) — `UNIQUE(display_name, discriminator)` prevents true duplicates

### Text Handling

- **Plain text only** — no markdown, no HTML in any freetext field
- React escapes HTML by default in JSX — do not use `dangerouslySetInnerHTML` for any user-generated content
- No profanity filter for v1

### Rate Limiting

No custom rate limiting for v1:
- Supabase built-in API rate limiting (~100 req/s per IP) is sufficient
- `UNIQUE(build_id, user_id)` constraint prevents double-liking
- Auth endpoints have Supabase built-in rate limits (email send limits, OAuth is naturally rate-limited by the redirect flow)
- UI friction (filling out the full build form) naturally limits build creation rate
- Can add database-level rate limiting later if needed

## Build URL Format

Build URLs use the Supabase UUID directly: `/build/a1b2c3d4-e5f6-7890-...`

No short IDs or slugs for v1. UUIDs are functional and avoid uniqueness issues.

## ESR Version Tracking

Each ESR patch can change item balance. Builds store the ESR version they were created on so users can tell if a build might be affected by balance changes.

### How It Works

- **On build creation**: The app reads the current ESR version from its local IndexedDB metadata (already stored as `esrVersion`) and saves it in the `esr_version` column. This is automatic — no user input.
- **On build edit**: The `esr_version_updated` column is set to the current ESR version at the time of the edit. The original `esr_version` never changes. Item snapshots are refreshed to reflect the current ESR data.
- **Never edited**: If a build has never been edited, `esr_version_updated` is null.

### Display on Build Card

Every build card on the listing shows an **ESR version badge** (e.g., "ESR 3.9.07"). If the build's version differs from the viewer's current ESR version, the badge is visually distinct (e.g., different color or warning style) to signal the build may be outdated.

### Display on Build Detail Page

- Always show the original ESR version the build was created on
- If the build was edited on a different version, also show the updated version (e.g., "Created on ESR 3.9.06, updated on ESR 3.9.07")
- If the build's version differs from the viewer's current ESR version, show a warning message: "This build was created on ESR 3.9.06 (you are on 3.9.07) — check the changelogs for balance changes"
- Individual item slots show version diff badges when snapshot data differs from current data (see "ESR Version Diff on Items" above)

## Author Profile Page (`/user/:userId`)

- Displays the author's display name with discriminator (e.g., "RuneMaster#4316") and avatar (if available from Discord)
- Lists all their builds (same card format as the builds listing screen)
- Accessible by clicking an author name anywhere in the app (build cards, build detail page)

### Profile Editing (owner only)

When viewing your own profile, an **"Edit Profile"** button is shown:
- Change display name (within validation limits) — generates a new discriminator
- Account deletion link (navigates to the account deletion flow)

## UI Components

The project uses **shadcn/ui** patterns (Radix UI primitives + Tailwind CSS + CVA). Existing components live in `src/components/ui/`.

### Existing Components Reused

| Component | Used For |
|-----------|---------|
| **Button** | Create Build, Save, Delete, Sign In, Like, nav actions |
| **Badge** | Class badge on build cards, like count, version diff warning badges |
| **Card** | Build cards on listing, equipment slot cards (mobile) |
| **Dialog** | Delete build confirmation, account deletion |
| **Input** | Build name, search on listing |
| **Label** | Form field labels on create form |
| **Popover** | Auth prompts (sign-in to like/create), help buttons |
| **Sheet** | Mobile nav (add Builds link + auth items to existing) |
| **Textarea** | Build description, skills freetext |
| **Spinner** | Loading states |
| **InputGroup** | Search input on builds listing |

### New Components to Add

#### Critical (required for core feature)

**DropdownMenu** — signed-in user menu in header
- Contains: My Builds, Profile, Sign Out
- Radix: `@radix-ui/react-dropdown-menu`
- Install: `npx shadcn@latest add dropdown-menu`

**Avatar** — user avatar display
- Used in: header user button, build cards (author), build detail, author profile page
- Radix: `@radix-ui/react-avatar`
- Install: `npx shadcn@latest add avatar`

**Select** — dropdown selects
- Used for: class filter on listing, sort dropdown, class picker on create form, ascendancy picker
- Radix: `@radix-ui/react-select`
- Install: `npx shadcn@latest add select`

**Command (Combobox)** — inline autocomplete item picker
- Used for: equipment slot pickers on create/edit form. Searches local item database (uniques, mythical uniques, runewords, and gemwords) with freetext fallback for custom item names.
- Dependencies: `cmdk` + existing Popover (combined into "Combobox" pattern per shadcn/ui docs)
- Install: `npx shadcn@latest add command`
- Note: Most complex new component. Each equipment slot in the grid becomes a Popover+Command combobox.

#### Important (loading/feedback UX)

**Skeleton** — loading placeholder
- Used for: build card skeletons while loading, build detail skeleton while fetching
- Dependencies: none (pure Tailwind animation)
- Install: `npx shadcn@latest add skeleton`

**Sonner (Toast)** — feedback notifications
- Used for: build saved, build deleted, like toggled, errors, "link copied"
- Dependencies: `sonner`
- Install: `npx shadcn@latest add sonner`

#### Nice-to-have

**Tooltip** — hover hints
- Used for: equipment slot labels in grid, short hints, version diff badge details
- Radix: `@radix-ui/react-tooltip`
- Install: `npx shadcn@latest add tooltip`
- Note: Could use existing Popover instead, but Tooltip is more appropriate for hover-only hints.

### Components NOT Needed

| Component | Why |
|-----------|-----|
| Tabs | Builds listing uses a toggle, not tabs |
| Switch/Toggle | "My Builds" can use a Button toggle |
| Separator | Tailwind border utilities suffice |
| ScrollArea | Native scrolling is fine |
| Alert | Warning banners use simple styled divs |

### New Dependencies

```
# Backend
@supabase/supabase-js

# Radix UI primitives (new)
@radix-ui/react-dropdown-menu
@radix-ui/react-avatar
@radix-ui/react-select
@radix-ui/react-tooltip          (optional)

# Third-party UI
cmdk                             (Command/Combobox autocomplete)
sonner                           (toast notifications)
```

### Component-to-Feature Map

| Feature Area | Existing | New |
|-------------|----------|-----|
| Header (signed out) | Button, Sheet | — |
| Header (signed in) | Button, Sheet | DropdownMenu, Avatar |
| Auth prompts | Popover | Tooltip (optional) |
| Builds listing | Card, Badge, InputGroup, Button, Spinner | Select, Skeleton |
| Build card | Card, Badge, Button | Avatar |
| Build detail (gear grid) | Card, Badge | Tooltip |
| Build detail (interactions) | Button, Popover, Dialog | Sonner |
| Build detail (version diff) | Badge | Tooltip |
| Build create/edit form | Input, Textarea, Label, Button | Select, Command |
| Author profile | Card, Badge | Avatar |

## Integration into Existing App

### What Changes

- Add dependencies (see New Dependencies above)
- Initialize Supabase client singleton (`src/core/supabase/client.ts`) with env vars
- Add auth state management (Redux slice + saga watching `onAuthStateChange`)
- Add builds state management (Redux slice + saga for listing/CRUD/pagination)
- Add new shadcn/ui components (DropdownMenu, Avatar, Select, Command, Skeleton, Sonner, Tooltip)
- Add new routes/views: builds listing, build detail, build creator, author profiles
- Add like/unlike functionality on shared builds
- Add post-registration consent gate for privacy policy acceptance
- Add account deletion flow (Edge Function or `security definer` RPC)

### What Stays the Same

- All existing item/runeword browsing, filtering, and search remains fully client-side
- The app remains a static SPA — no server-side rendering needed
- Hosting can remain on any static host (Vercel, Netlify, Cloudflare Pages — all free)
- Supabase only gets involved when a user interacts with the build sharing feature
- The builds feature is **online-only** — the rest of the app remains offline-capable with cached data

## Supabase Client Initialization

The Supabase client is a singleton initialized in `src/core/supabase/client.ts`. It reads the Vite environment variables (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) and exports a single `supabase` instance used throughout the app.

**Graceful degradation:** If the Supabase env vars are not set (e.g., a contributor running the app without Supabase), the builds feature is hidden entirely (no "Builds" nav item, no "Sign In" button). The rest of the app (runewords, socketables, uniques, mythicals, ascendancies) works normally. This is checked once at startup and stored in Redux.

## Supabase Setup

See **[SUPABASE-SETUP.md](./SUPABASE-SETUP.md)** for the complete step-by-step setup guide covering both PROD and DEV environments.

## Error & Loading States

- **Supabase unreachable**: Show a non-blocking warning banner on the builds screen: "Builds are temporarily unavailable." The rest of the app (runewords, socketables, uniques) continues to work normally since it uses local data.
- **Supabase resuming from pause**: First load after inactivity may take 1-2 minutes. Show a loading state with skeleton cards. Once resumed, everything works normally.
- **Loading builds**: Show skeleton cards while builds are being fetched.
- **Build not found**: Show a "Build not found" message on `/build/:buildId` if the build ID doesn't exist or has been deleted.
- **Offline**: The builds feature requires an active internet connection. When offline, the builds nav item can show a subtle indicator that it's unavailable. The rest of the app remains fully functional with cached data.

## Account Deletion

Users must be able to fully delete their account and all associated data. This is both a GDPR requirement (right to erasure) and good practice.

### Flow

1. User navigates to account settings and clicks "Delete my account"
2. A confirmation modal appears with a clear warning: "This will permanently delete your account, all your builds, and your likes. This action cannot be undone."
3. User must confirm the deletion (e.g., type their display name or click a final "Yes, delete everything" button)
4. On confirmation, the app calls a Supabase Edge Function or `security definer` RPC that:
   - Deletes the `profiles` row (cascades to `builds` and `likes` via `ON DELETE CASCADE`)
   - Deletes the `auth.users` record via Supabase Admin API
5. User is signed out and redirected to the home page

### Implementation Note

Deleting from `auth.users` requires the Supabase service role key, which must never be exposed client-side. Use a Supabase Edge Function or a `security definer` database function to handle this. The cascade from `profiles` to `builds` and `likes` is handled automatically by `ON DELETE CASCADE` foreign keys — no manual deletion of those tables is needed.

Account deletion is **required for v1 launch** (GDPR right to erasure).

## Privacy Policy

The app includes a Privacy Policy (`PRIVACY_POLICY.md`) that is:

- Linked in the app footer/settings page and accessible at all times
- Shown and must be accepted (via unchecked checkbox) during the post-registration consent gate flow
- Hosted in the GitHub repository alongside the source code
- Written in plain language, no legalese

### What the Privacy Policy Covers

- What data is collected (email or Discord ID, display name, build data, likes)
- Why it is collected (to provide the build sharing feature)
- Where it is stored (Supabase, region specified)
- What is publicly visible (display name with discriminator and public builds only — never email)
- Third-party processors (Supabase, Discord for OAuth, Cloudflare for anonymous traffic analytics)
- User rights under GDPR (access, export, deletion)
- How to request data access/export/deletion (account settings + contact email)
- Data retention policy (data kept until account deletion)
- Anonymous, cookieless traffic analytics via Cloudflare Web Analytics (no personal data, no cross-site tracking, no fingerprinting); no ads, no data selling

### Data Export

Data export for GDPR compliance is handled manually by a developer for v1. No in-app export feature. Users can request an export via the contact email listed in the privacy policy.

## Environments

### Dual Supabase Projects

Two separate Supabase projects are used:

| Environment | Purpose | Users |
|-------------|---------|-------|
| **PROD** | Published to real users | Real community members |
| **DEV** | Development and testing | Solo developer + test accounts |

Both environments have identical schema, Discord OAuth, and email magic link configured. Each has its own Discord app in the Discord Developer Portal (separate Client ID/Secret and redirect URLs).

### Vite Environment Variable Switching

Vite natively loads different `.env` files based on the mode:
- `npm run dev` → loads `.env.development` (DEV Supabase)
- `npm run build` → loads `.env.production` (PROD Supabase)

No manual switching needed — it's automatic.

**Environment files (committed to repo):**

`.env.development`:
```
VITE_SUPABASE_URL=https://xxx-dev.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...dev
```

`.env.production`:
```
VITE_SUPABASE_URL=https://xxx-prod.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...prod
```

Anon keys are safe to commit — they're public by design (exposed in the browser bundle). Row Level Security handles authorization.

**Secret file (gitignored via `*.local` pattern):**

`.env.local`:
```
# Only used by the seed script — never exposed to the browser
DEV_SUPABASE_URL=https://xxx-dev.supabase.co
DEV_SUPABASE_SERVICE_ROLE_KEY=eyJ...secret
PROD_SUPABASE_URL=https://xxx-prod.supabase.co
PROD_SUPABASE_ANON_KEY=eyJ...prod
```

### SQL Migrations

Database schema changes are tracked as numbered SQL migration files in the repository:

```
supabase/migrations/
├── 001_initial_schema.sql    # Tables, triggers, RLS, functions
├── 002_xxx.sql               # Future changes
└── ...
```

Migrations are applied manually via the Supabase SQL editor to both PROD and DEV. The initial migration (`001`) contains all table creation, triggers, RLS policies, and functions from this document.

When a new feature requires schema changes, a new numbered migration file is added. Apply to DEV first, test, then apply to PROD before deploying the corresponding code.

### PROD → DEV Data Seeding

A local Node.js script (`scripts/seed-dev-from-prod.ts`) copies real build data from PROD to DEV for realistic testing:

1. Reads all builds from PROD (public SELECT via anon key — no service key needed)
2. Wipes existing DEV data (clean slate)
3. Creates test users in DEV via Supabase Admin API (service role key):
   - Uses test email addresses: `testuser1@example.com`, `testuser2@example.com`, etc.
   - Each gets a profile with a generated display name + discriminator
4. Copies builds into DEV, randomly assigning them to test users
5. Generates random likes across test users for realistic like counts

Run manually: `npx tsx scripts/seed-dev-from-prod.ts`

Requires `.env.local` with DEV service role key (see above). The service role key bypasses RLS and allows creating users via the Admin API.

### Testing & Release Strategy

- **DEV environment** for all development and testing
- **Manual testing**: Build and test features against DEV Supabase with test accounts
- **Beta release**: The builds menu item is hidden initially behind a feature check. Enable for internal testing on PROD, then release as an experimental/beta feature
- **User expectations**: Users are informed the feature is in beta — expect possible bugs
- **Iterative refinement**: UI polish, edge cases, and additional features (comments, tags, etc.) come after the core feature is stable

## Development Notes (changes during implementation)

These were decided or discovered while building the feature, amending the original design:

- **Gemwords added as a fifth item type.** Gemwords were introduced to the app after this spec was first written, so they are included everywhere runewords are (build_data reference type, autocomplete group, snapshot). See the gemword sections above.
- **PostgREST embed needs a FK hint.** Because `likes` references both `builds` and `profiles`, PostgREST finds two `builds`↔`profiles` relationships and a bare `profiles(...)` embed errors with PGRST201. All build queries embed the author as `profiles!builds_user_id_fkey(...)`.
- **Bad build ids resolve to "not found".** `build.id` is a `uuid`; a malformed id in a URL makes PostgREST error on the cast rather than return zero rows. The detail fetch validates the id is a UUID first and shows "Build not found" for malformed (and valid-but-missing) ids.
- **Unsaved-changes guard covers in-app navigation too.** Beyond the `beforeunload` prompt, the create/edit form uses React Router's `useBlocker` to confirm before client-side navigation (nav links, back button). The blocker reads its enabled flag from a ref so a post-save programmatic navigate is not blocked.
- **Incremental build of the create form.** The create form shipped first as basic info (name/description/class — empty builds are allowed per spec), then the equipment editor was layered on slot by slot. Empty/partial `build_data` is valid.
- **Supabase SDK is lazily loaded.** A lightweight `config` module exposes `isSupabaseConfigured` for the eager app shell; the SDK client lives in a separate module imported only by the (lazy) auth/builds sagas, keeping `@supabase/supabase-js` out of the main bundle.
- **Consent gate keeps the trigger-assigned discriminator.** The display-name-change discriminator regeneration (with collision retry) is implemented as part of profile editing, not the consent gate.
- **Discriminator regeneration is client-side.** Renaming via the profile-edit dialog generates a fresh random discriminator (1000–9999) in the auth saga and retries on the `(display_name, discriminator)` unique violation (PostgREST code `23505`), up to 10 attempts before surfacing an error. No extra DB function/migration is needed — the existing per-row UPDATE policy covers it.
- **Author profile page reuses the builds list machinery.** `/user/:userId` reads the public `profiles` row (UUID-guarded like build ids) plus that author's builds via the same `BUILDS_SELECT` embed and keyset cursor (newest-first only — no sort toggle), with infinite scroll. Its state lives alongside the builds slice (`authorProfile` + `authorBuilds`), separate from the main listing state. After an owner rename, the page refetches so the header and cards reflect the new tag.
- **Profile editing scope.** The "Edit Profile" dialog currently changes the display name only (avatar comes from Discord; magic-link users keep the initials fallback). The account-deletion link described for this dialog ships with the account-deletion phase.
- **Per-item ESR diff badges.** On the detail page each item's stored snapshot is re-resolved against the viewer's current local data (`utils/itemDiff.ts`: `resolveCurrentRef` + an order-independent `deepEqual` so Postgres jsonb key reordering isn't a false diff). Item stats are shown from **current** data; a changed item gets an amber "Stats updated" toggle that reveals the snapshot saved with the build, and an item missing from local data falls back to the saved snapshot with a "may no longer exist in the current ESR version" note. Diffs are computed via `useLiveQuery` (so they react to local data loading) and only surfaced once `esrVersion` is present, to avoid flagging everything as missing before local data finishes loading. `refreshBuildData` now shares `resolveCurrentRef`.
- **Reused the rich browse-page item cards.** Equipped items render with the same `HtmUniqueItemCard` / `MythicalUniqueCard` / `RunewordCard` / `GemwordCard` (colours, affixes, rune/gem badges, socketable bonuses) used on the browse pages — same pattern as `AscendancyCard`. Those cards need the full local-DB record (far more than the saved snapshot), so `utils/resolveItem.ts` resolves each slot's ref against current local data and a new `BuildItemCard` renders the matching card via `useLiveQuery`; it falls back to the saved-snapshot text (`ItemRefDisplay`) for freetext, items missing from the current ESR data, or while data loads. Used on the detail page (read-only) and as the live preview under each picker in the create/edit form. The per-item version-diff badge and "saved snapshot" reveal are kept on top of the rich card. The four cards are now exported from their feature barrels (plus `useGemBonusMap`).
- **JSON export on the detail page.** Any viewer can download a build as a raw `.json` via an "Export" button that opens a modal (explains it's a plain snapshot for safekeeping, not an import format) with Download/Close. The file wraps the full build record under a small provenance header (`exportedAt`, app name, source URL); filename is a slug of the name + short id (`utils/buildExport.ts`, client-side Blob download — no backend). Re-import is out of scope.
- **Per-item crafting/corruption notes.** ESR items are heavily modifiable (rune-forging, D-Stone crafting, beneficial corruption), so each equipped slot (Player Gear, Weapon Swap, Mercenary) has an optional free-text note (max 500 chars) shown under the item — e.g. "D-Stone until very fast attack speed". Stored in `build_data` as per-slot maps parallel to the item maps (`itemNotes`/`weaponSwapNotes`/`mercenaryNotes`), so notes survive the on-edit snapshot refresh and persist when the item in a slot is swapped; emptying a slot clears its note. No migration (lives in the JSONB). Editable textarea in the form (under the slot's item), read-only block on the detail page.
- **Liked indicator on build cards.** Cards show a filled heart (in the same muted color as the count, via `fill-current`) when the signed-in viewer has liked that build, so the listing and author-profile pages reveal which builds you've liked. After each page loads, the saga runs one `likes` query (`select('build_id').eq('user_id', viewer).in('build_id', pageIds)`) and stores the matches in the slice (`likedBuildIds` for the main list, `authorLikedBuildIds` for profiles; replaced on a fresh fetch, unioned on load-more). Display-only — liking still happens on the detail page; the lists self-refresh on mount so the state stays current.
- **Account deletion is manual for now.** Automated erasure (Edge Function / `security definer` RPC) is not built yet. The Edit Profile dialog has a "Delete account" link that opens an info view explaining automatic deletion isn't available and linking to a GitHub issue (`/issues/new`) so the developer can erase the account (profile + builds + likes via the existing `ON DELETE CASCADE`) manually. The automated flow and the privacy policy's "right to erasure" wording (which still describes immediate self-service deletion) are reconciled in a later phase.
- **Privacy policy location.** `PRIVACY_POLICY.md` currently lives in `builds-feature-docs/`; it must be moved to the repo root and the consent-gate link confirmed before public launch.

## Out of Scope (For Now)

- Comments on builds
- Build versioning / edit history
- Build import/export
- User following / social features
- Build categories or tags
- Admin moderation dashboard
- Structured skill trees (per-class skill point allocation UI) — skills are freetext for now
- Build templates or presets
- Build comparison (side-by-side)
- Build duplication / "use as template"
- Private or draft builds
- Ascendancy-based filtering on the builds listing
- Inline rune bonus breakdown on build detail (only runeword-level bonuses shown)
- Dynamic OG tags / social media link previews for build URLs
- Markdown or rich text formatting in freetext fields
- Profanity filter / content moderation
- Short/vanity URLs for builds (using UUID is fine for v1)
- Set items (not parsed or stored in the app yet)
- In-app data export (handled manually by developer for v1)
- Custom rate limiting (Supabase defaults suffice for v1)
