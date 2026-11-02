# Feature: Loot filter sharing with Supabase

Status: planning (branch `feat/loot-filter-sharing`). Builds on the build sharing backend
([FEATURE-BUILD-SHARING.md](./FEATURE-BUILD-SHARING.md), `supabase/migrations/001`–`004`) and the loot filter editor
([docs/features/LOOT-FILTER.md](../docs/features/LOOT-FILTER.md)).

## Owner decisions (2026-11-02)

| Topic                    | Decision                                                                                                                                                                                                 |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Where filters live       | Saved filters live in Supabase. A filter is public unless the owner ticks **Private** (then only the owner sees it).                                                                                     |
| Saving                   | Only an explicit **Save** writes to Supabase. Starting, uploading, copying and editing stay in a browser backup (drafts) until Save, so nothing half-finished is shared by accident.                     |
| Drafts                   | The current localStorage library becomes the draft store: new unsaved filters, unsaved edits of saved filters, and the filters users already have in their browser (each saved or discarded one by one). |
| Signed-out visitors      | Browse, open (sandbox) and download public filters, and create / upload / edit drafts as today. Save, Like and Copy to my filters ask them to sign in.                                                   |
| Default visibility       | Public, copies too. Copies are labelled "based on X".                                                                                                                                                    |
| Copies                   | A copy stays linked to its source; when the source changes the copy shows **Update available**. Filters started from Sully's bundled template do the same when we bundle a newer Sully version.          |
| Viewing others' filters  | **Sandbox**: the full editor on a temporary copy (tweak, Test tab, download the tweaked file); nothing is written anywhere; a banner offers **Copy to my filters** to keep the changes.                  |
| List contents            | Name, description, author, the ESR / plugin / filter versions it was created with, rule count, levels (when it has them), likes, downloads; Open or Download straight from the card.                     |
| Social                   | Likes (like builds), a download count, the author's filters on `/user/:userId`, a "Latest loot filters" block on the home page.                                                                          |
| What changed             | Saving a public filter's content takes an optional short note; copies show it in their Update available banner, the filter's card / header shows the latest one.                                         |
| Sully's filter           | The Shared tab starts with a pinned card for the bundled Sully's QoL filter (version, rule count, Open / Download / Start from it).                                                                      |
| `updateUrl`              | Not tied to sharing. A shared filter's `updateUrl` is left as the author wrote it.                                                                                                                       |
| Limits                   | File up to 512 KB, up to 50 filters per user (private ones included), name 1–100 characters, description up to 2000, change note up to 200.                                                              |
| "Under development" note | Removed from the loot filter pages: the editor is usable.                                                                                                                                                |

Defaults chosen while planning:

- **Validation on Save**: a file the lenient reader cannot read, or with `formatVersion` other than 1, cannot be saved.
  Validator errors and warnings are listed in the Save dialog but do not block (Sully's own v0.6.11 has one error).
- **Content kept verbatim**: the saved `content` is the draft's text as is (comments in an unedited upload stay).
- **Save conflicts**: Save is a compare-and-swap on `revision`. If the row changed elsewhere, the dialog offers
  **Overwrite** or **Save as a new filter**; if it was deleted (or is not the user's), only **Save as a new filter**.
  `revision` only moves on content changes, so a rename or Private toggle from another tab is last-write-wins.
- **Download count**: Download clicks, signed in or not, the author's own included. A rough number.
- **Plugin version**: a `LOOT_FILTER_PLUGIN_VERSION` constant (currently `1.5.3`), bumped when the editor targets a new
  plugin. Sully's template version: a `TEMPLATE_VERSION` constant next to `TEMPLATE_CREDIT` (checked by a test against
  the bundled file).
- **Without Supabase env vars** (forks, tests): drafts and the sandbox work; Save, the Shared tab, likes and profile
  blocks are hidden with a note.
- **"Most downloaded"** sort is offered, with its own cursor index like "Most liked".

## Data model: `supabase/migrations/005_loot_filters.sql`

Applied by hand in the Supabase SQL editor, DEV first, then PROD (same as 001–004).

### `loot_filters`

| Column                                          | Type           | Notes                                                                                                                      |
| ----------------------------------------------- | -------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `id`                                            | `uuid` pk      | `gen_random_uuid()`; the share link is `/loot-filters/:id`.                                                                |
| `user_id`                                       | `uuid`         | `references profiles(id) on delete cascade`.                                                                               |
| `name`                                          | `text`         | 1–100 characters. The list name, not the file's `title`.                                                                   |
| `description`                                   | `text` null    | Up to 2000 characters, plain text.                                                                                         |
| `content`                                       | `text`         | The filter file. `octet_length(content) <= 524288`.                                                                        |
| `is_private`                                    | `boolean`      | Default `false`.                                                                                                           |
| `title`, `author`, `file_version`               | `text` null    | From the file at save time (≤ 200 characters each).                                                                        |
| `rule_count`                                    | `integer`      | From the file at save time.                                                                                                |
| `levels`                                        | `jsonb` null   | The file's `filterLevels`, `[{id, name}]`, ≤ 4 KB; null when the file has none.                                            |
| `esr_version`, `plugin_version`                 | `text` null    | At creation; never change.                                                                                                 |
| `esr_version_updated`, `plugin_version_updated` | `text` null    | At the last content save; null if never re-saved.                                                                          |
| `change_note`                                   | `text` null    | The latest "what changed" note (≤ 200 characters); cleared by a content save without one.                                  |
| `based_on_id`                                   | `uuid` null    | The shared filter this one was copied from; `references loot_filters(id) on delete set null`. Set on insert only.          |
| `based_on_revision`                             | `integer` null | The source's revision the copy has (moves when the user takes an update).                                                  |
| `based_on_template`, `based_on_version`         | `text` null    | For a filter started from a bundled template: `'sullys-qol'` and its `version` (e.g. `0.6.11`).                            |
| `based_on_label`                                | `text` null    | "Sully's QoL Filter v0.6.11" / "X by Y#1234", kept for the label when the source is deleted or private (≤ 200 characters). |
| `revision`                                      | `integer`      | Default 1; bumped by the trigger when `content` changes. Clients cannot write it.                                          |
| `likes_count`, `download_count`                 | `integer`      | Default 0; maintained by a trigger / an RPC only.                                                                          |
| `created_at`, `updated_at`                      | `timestamptz`  | `updated_at` is set by the trigger only when the filter itself changes (not on likes or downloads, unlike `builds`).       |

Indexes: `(created_at desc, id desc)`, `(likes_count desc, created_at desc, id desc)`,
`(download_count desc, created_at desc, id desc)`, `(user_id)`, `(based_on_id)`.

Triggers and functions:

- `loot_filters_before_update` (plain, not definer; column grants do not cover what a trigger writes into `NEW`): when
  `content` changes, `revision := old.revision + 1`; when content, name, description, `is_private` or the file
  metadata change, `updated_at := now()`. `based_on_id` is not in that list (its `on delete set null` must not touch
  `updated_at`).
- `loot_filters_cap` (before insert, `security definer set search_path = ''`): raises `loot_filter_limit` when the user
  already has 50 filters. The client turns it into "You have 50 filters; delete one to save another."
- `loot_filter_likes (filter_id, user_id)` pk, index on `user_id`, a definer trigger maintaining `likes_count` (copy of
  001's).
- `increment_loot_filter_download(filter_id uuid)`: security definer, `+1` where `id = filter_id and (not is_private or
user_id = auth.uid())`, granted to `anon` and `authenticated`.

RLS:

- `loot_filters` select: `not is_private or auth.uid() = user_id`. Insert / update / delete: owner only.
- `loot_filter_likes` select: `exists (select 1 from loot_filters f where f.id = filter_id)` (RLS on the subquery hides
  likes of private filters). Insert: `auth.uid() = user_id` and the filter exists and is public. Delete: own row. Likes
  stay when a filter goes private and count again when it is public again.

Grants (003 style): revoke insert / update on `loot_filters` from `anon, authenticated`; grant insert on the user
columns (everything except `id`, `revision`, `likes_count`, `download_count`, `created_at`, `updated_at`) and update on
`name, description, content, is_private, title, author, file_version, rule_count, levels, esr_version_updated,
plugin_version_updated, change_note, based_on_revision, based_on_version, based_on_label`.

`src/core/supabase/types.ts` gets the Row / Insert / Update types by hand, as for builds. Queries embed the author with
`profiles!loot_filters_user_id_fkey(...)` (likes add a second path to `profiles`).

## Client model

### Editor target

Today the editor only edits library entries. It gets an explicit target:

```ts
type EditorTarget =
  | { kind: 'draft'; entryId: string } // a new, never-saved filter (or an old local one)
  | { kind: 'saved'; savedId: string; revision: number; ownerId: string; baseText: string; baseCanonical: string }
  | { kind: 'sandbox'; savedId: string | null; baseText: string }; // someone else's filter, or Sully's template
```

- **Draft**: as today; the debounced flush writes the entry.
- **Saved** (the owner's filter): `openSaved(row)` uses the draft whose `savedId` matches, if any, else the row's content.
  The flush creates the draft on the first edit. `baseCanonical` is `serialize(parse(content))`, computed once on open;
  a draft equal to it is dropped (comparing with the verbatim content would almost never match).
- **Sandbox**: the editor works but nothing is flushed. Leaving with changes asks once. **Copy to my filters** turns the
  current model (or the original, if unchanged) into a new draft with `basedOn`.
- A `readOnly`-style guard is not needed: the sandbox simply never persists.

### Drafts (localStorage)

The `loot-filters/library` entries stay the draft store, with optional fields (the strict `source` guard stays
compatible with older tabs):

```ts
interface LootFilterEntry {
  // existing: id, name, source, createdAt, updatedAt, text
  readonly savedId?: string; // the saved filter this draft edits
  readonly savedOwnerId?: string; // its owner: drafts of another account are hidden
  readonly savedRevision?: number; // the revision the draft started from (compare-and-swap)
  readonly basedOn?: { id?: string; revision?: number; template?: string; version?: string; label: string };
}
```

- A **new** draft (New, Upload, Start from Sully's, Copy) has no `savedId`. Its first Save inserts the row, removes the
  draft, and switches the editor target to `saved` without remounting (route replaced, tabs and Test form kept).
- **Save** first flushes the pending debounce and sends that exact text; on success the draft is removed only if its
  text still equals what was sent, and the target's base becomes the new content and revision in the same reducer.
  **Discard changes** removes the draft, clears `dirty` and re-parses the base, so a late flush does nothing.
- Save warns when the JSON tab has unapplied text.
- Name, description and Private of a saved filter are server fields: they change through the dialog with an immediate
  update, never through a draft. A draft carries a name only while the filter is new.
- `duplicate` copies neither `savedId*` nor `basedOn`.
- Drafts with a `savedOwnerId` other than the signed-in user are hidden (kept in storage); signed out, they show under
  "Sign in to save".
- Old `source: 'template'` entries infer `basedOn` from the file's `version`.
- localStorage holds about 5 MB: roughly ten very large drafts. The existing "storage full" toast covers it.

### Copies and updates

- **Copy to my filters** sets `basedOn` only when the source is public and someone else's (plain copy otherwise, so a
  private name never leaks into a public label). Start from Sully's sets `template` / `version`.
- **Update available**: My filters runs one query `select id, revision, change_note from loot_filters where id in
(based_on ids)`; a missing id means "The original is no longer shared" (deleted or private; the copy keeps working and
  keeps its label). Template-based filters compare with `TEMPLATE_VERSION`.
- The banner shows the source's change note and offers **Replace with the latest** (loads it as unsaved changes and
  records the new `based_on_revision` / `based_on_version` in the draft so Save writes them; confirms first when a draft
  already exists) and **Add as a new filter**.

### Routes

| Route                     | Screen                                                                                                     |
| ------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `/loot-filters`           | Tabs **Shared** (pinned Sully card, then the public list) and **My filters** (saved filters, then drafts). |
| `/loot-filters/:id`       | A saved filter: the editor for its owner, the sandbox for everyone else. A local draft id redirects.       |
| `/loot-filters/draft/:id` | A draft.                                                                                                   |
| `/loot-filters/sully`     | The sandbox on the bundled Sully filter (from the pinned card).                                            |

Local ids and row ids are both UUIDs, so `/loot-filters/:id` looks in the hydrated library first, then fetches the
row. Old bookmarks to a draft stop working after its first Save.

### Library screen

- **Shared** tab: search by name (server-side `ilike`), sort Newest / Most liked / Most downloaded, cursor pagination
  (50 per page, list columns only, never `content`), infinite scroll with the builds' `LoadMoreError`.
- Card: name, 2-line description, author (avatar + `name#1234`, links to `/user/:userId`), "Created on ESR x · plugin y
  · filter v z" (and "updated on …" when re-saved), rule count, level names, likes, downloads, "based on X", the latest
  change note, Private badge (own only); **Open** and **Download**.
- **My filters** tab (default when signed in): the user's saved filters (badges: Private, Unsaved changes, Update
  available), then "Unsaved in this browser" with the drafts (Save / Discard). New / Upload / Start from Sully's live
  here. Signed out: the drafts with "Sign in to save".

### Editor header

Name, Private badge, **Save** (first Save opens the dialog: name, description, Private, and the validator's counts;
later Saves of a public filter ask for the optional change note), "Unsaved changes" / "Saved" status, **Discard
changes**, **Details** (rename, description, Private), Download, Delete (confirmed; copies of it say "no longer
shared"). Sandbox: author, Like, Download, **Copy to my filters**, the not-saved banner.

### Profile and home

- `/user/:userId`: a "Loot filters" section under Builds, same cards, paged; the owner also sees their private ones.
- Home: a "Latest loot filters" block next to Latest builds (public, newest).

### Store / saga

`src/features/loot-filter/sharing/`: slice, saga and query module following `builds/store` (`takeLatest` list fetch,
cursor helpers, optimistic likes, the FK embed hint), loaded with `loadAfter(...)` like builds. Save, discard and the
editor target live in the existing loot filter slice and saga; the sharing saga does the network calls and puts the
results back.

## Other changes

- Remove the "Under development" `DevNotice` from `LootFilterLayout`.
- `PRIVACY_POLICY.md`: loot filters (public and private), their likes and change notes are stored with the account;
  public ones are visible to everyone; account deletion removes them.
- Docs: `LOOT-FILTER.md` (sharing, drafts, sandbox), the backlog's "Loot filter sharing" section marked done,
  `SUPABASE-SETUP.md` (apply 005).

## Phases

1. Migration 005, types, query module, sharing slice and saga (list, detail, save, delete, like, download, source
   revisions), logic tests. The owner applies 005 to the DEV project.
2. Editor target refactor and drafts: `openSaved`, sandbox, save / discard / conflict flows, entry fields, logic tests.
3. UI: library tabs, cards and the pinned Sully card, Save / Details dialogs, editor header and status, update banner,
   sandbox banner.
4. Profile and home blocks, privacy policy, docs, remove the dev notice. Review, then the owner tests against DEV.
