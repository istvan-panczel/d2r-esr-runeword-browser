# Terror Zones

A tracker for the **offline** (single-player) terror zone rotation of ESR: a floating widget at the bottom left of
every page and a full schedule page at `/terror-zones` (Tools menu). Code: `src/features/terror-zones/`; data:
`public/game-data/terrorzones.json` (see [Game Data](./GAME-DATA.md#terror-zones)).

## How the game picks the zone

Offline D2R, and so ESR (played offline), does not ask a server: it works the terror zone out from
`data/hd/global/excel/desecratedzones.json` and the PC clock. ESR 3.3 ships one config: start
2025-12-05 00:00:00 UTC, seed `16664395743969097666`, 60-minute zones, no break, 20 zone groups `ESR-Zone01` …
`ESR-Zone20`, each a list of `level_id`s. Since 3.3 every campaign group also holds one endgame map and all zones
but the towns and a few special levels belong to a group; 3.2.24 had 22 groups, `ESR-Zone19` … `ESR-Zone22` being the endgame-map groups.
3.3 reused `ESR-Zone19` and `ESR-Zone20` for two new Act 1 groups (see [Watched groups](#watched-groups-and-notifications)
for the starred-group reset).

The rotation (recovered from the game executable by d2r-arcane-tracker, `docs/TERROR_ZONE_FINDINGS_2026.md` there):

- `period = (zone_duration + break_duration) × 60` s, `slot = floor((t − start) / period)`; inside a break (or before the
  start) there is no zone.
- `roll(t) = uint32_le(SHA-1(uint64_le(t XOR seed))[0..4]) / 2^32`.
- Every zone starts with the weight `1 / (N − 1)`; a virtual pick at `roll(start − period)` zeroes one zone. Then for
  each slot from 0 on: pick the first zone whose cumulative weight exceeds `roll(slotStart)` (the last one when rounding
  leaves the sum just below 1), add the picked zone's `weight / (N − 1)` to every zone and set the picked zone to 0.

So a zone never repeats and gets likelier while it waits, and every slot depends on all the slots before it: the
schedule is replayed from the start (8,077 slots on 2026-11-06, about 12 ms). **The zone list, its order, the seed,
the start and the durations all feed the rotation: a release that changes any of them changes every slot.** The game
walks the configs in file order and uses the first covering the time; the app schedules one config, so the generator
**fails** (`game-data:generate` throws, pointing at the `/esr-update` reference) when the file has more than one, and
warns when the config has an end time. Start and end must read exactly `YYYY-MM-DD HH:MM:SS` (UTC).

The port is `engine/rotation.ts` (MIT notice of both sources in its header): a `Rotation` per config caches the picks,
so later slots extend the replay instead of starting over. `engine/sha1.ts` is a small synchronous SHA-1 (one block,
at most 55 bytes), since `crypto.subtle.digest` is async. `engine/schedule.ts` turns slots into windows (`currentWindow`,
`upcomingWindows`, `windowsFrom`, `nextWindowPerZone`).

Checked by `engine/schedule.test.ts` against the retail config (d2emu's published slots via d2r-arcane-tracker's
tests, and ESR Docs' retail picks). The ESR 3.2.24 in-game checks (2026-10-31 … 2026-11-06) no longer apply, since
3.3 regrouped the zones and so moved every slot; the ESR 3.3 slots await an in-game check (then they go back into
the test as dated `[utc, zoneId]` pairs). Until then the ESR tests check the committed bundle's schedule for
consistency only (hourly windows, no repeat, upcoming and next-per-group windows). `engine/sha1.test.ts` compares the
SHA-1 with `node:crypto`.

## Data: `terrorzones.json`

```jsonc
{
  "esrVersion": "3.3",
  "config": { "start": 1764892800, "end": null, "seed": "16664395743969097666", "zoneMinutes": 60, "breakMinutes": 0 },
  "boosts": [{ "version": "expansion", "difficulty": 0, "minLevel": 3, "maxLevel": 45, "levelBoost": 4, "xpPercent": 50 }, …],
  "zones": [{ "id": "ESR-Zone03", "labels": ["Catacombs", "Necropolis (Tier 1)", "The Secret Cow Level"], "areas": [{ "id": 39, "name": "The Secret Cow Level" }, …] }, …]
}
```

- `config.seed` is a string: the file writes it as a bare 64-bit number and `JSON.parse` would round it (the
  generator quotes it before parsing). `start` / `end` are Unix seconds.
- `zones` keep the file order (it is part of the rotation). `labels` are the names the game's terror zone display lists:
  each level group once (levels.txt `LevelGroup` → levelgroups.txt `NameString`, "Chasm of Horrors (Tier 1)"), then the
  levels without a group (`LevelName`), as ESR Docs resolves them and checked against its in-game screenshots. `areas`
  are the zone's levels as areas.json names them (the Areas page and campaign map names; map entrances and removed
  levels are not areas, `terrorZoneUnlistedLevels`).
- `boosts`: `game_difficulties.<expansion|rotw>.<difficulty>.defaults`: `boost_level`, `boost_experience_percent` and
  the monster level bounds `bound_incl_min` / `bound_incl_max`. ESR 3.3 (as 3.2.24): Lord of Destruction +4 levels, +50% XP;
  Reign of the Warlock +2, +25%; bounds 3–45 / 40–71 / 70–96. The herald tiers and unique mod boosts of RotW Hell are
  not carried.

The browser loads it with `loadGameDataFile('terrorzones')` (manifest + one 12 KB file) into one shared store
(`store/scheduleStore.ts`, `useTerrorZoneSchedule`), so the widget and the page share the `Rotation` cache.

## Widget

`components/TerrorZoneWidget.tsx`, mounted once by `AppLayout` (lazy, from `@/features/terror-zones/widget`, inside a
`Suspense` with no fallback), so it is on every page that renders the app shell and costs nothing until its chunk and
the bundle arrive. It renders nothing while loading or after a failed load, and nothing visible on `/terror-zones`
itself (`isWidgetHidden`; the page shows it all), where it still runs the notifications.

- **Open**: a card (`w-80`, at most `100vw − 6rem` so it never reaches ScrollToTopButton) with the current group (the
  game's names), a live countdown to the next change, the next 3 groups with their local start times ("Show more": 12;
  day names relative to the real time, not the slot start, so a slot crossing local midnight in a half-hour time zone
  is labelled right),
  star toggles, a link to the page, the terror boost in larger bold text in the terror colour, one line per game
  version (`LoD: +4 monster levels, +50% XP`, `RotW: +2 monster levels, +25% XP`, then `Monster level cap 45 / 71 /
96`; `formatBoostLines` in `utils/boosts.ts`), and the ESR version.
- **Minimised**: a round outline button with a bold "TZ" (`TzMark`) in the terror colour, the ScrollToTopButton style. A watched group terrorized now gives
  it a `warning` ring and a pulsing dot; a watched group next, a softer ring and a still dot (`watchAlert`).
- **Colour**: `--terror` / `text-terror` (`src/index.css`), the in-game terror zone purple-pink, lighter in dark mode.
- **Focus**: after a click on minimise the circle gets the focus, after opening the card's minimise button (never on
  mount).
- **Open or minimised** is remembered in this browser (`terrorZones.widgetOpen`, `usePersistentState`); without a stored
  choice it starts open, and minimised below `sm` (phones).
- **Position**: `fixed`, bottom-left, `z-40` (dialogs and sheets are z-50 and cover it), with the safe-area insets. It
  moves up where the app has fixed bottom elements (`utils/widgetPosition.ts`): the builds form's sticky Save / Cancel
  bar (`/builds/new`, `/builds/:id/edit`) and the guide note's phone "Next on your path" bar (`/guide/:slug`, below
  `sm`). ScrollToTopButton and the toasts are bottom-right.

## Page (`/terror-zones`)

`screens/TerrorZonesScreen.tsx`, a static-bundle route (no startup gate). Top to bottom:

- "Terrorized now" (countdown, end time) and "Next" cards;
- a `ToolbarCard`: "Watched only" filter and the notification toggle;
- **Schedule**: the next 48 slots in local time with a day separator per local day, the current slot first and
  highlighted, watched rows highlighted, star toggles; "Load 48 more hours";
- **Zone groups**: all 20 in file order, star toggle, the game's names, "Next: Sun 14:00 (in 2 d 4 h)" or "Terrorized
  now" (`nextWindowPerZone`, up to 1000 slots ahead), and a collapsible list of the group's areas linking to the
  campaign map;
- **Terror boost**: a table per game version and difficulty;
- **About**: the schedule is for ESR `<version>` offline and follows the PC clock; another ESR version can change it;
  online games use Blizzard's schedule; the credits: "Rotation algorithm ported from d2r-arcane-tracker by Fredrik
  Pettersson (MIT), via ESR Docs by Syzygy", linked.

## Watched groups and notifications

- Users star whole zone groups (not single areas). Stored in this browser only: `terrorZones.watched` (zone ids) in
  localStorage, through one shared store (`store/preferences.ts`) so the widget and the page stay in sync; other tabs
  follow through the `storage` event. Ids the current bundle does not have are ignored (`knownWatched`).
- **Reset when ESR regroups the zones**: an id can survive with another meaning (3.3 turned `ESR-Zone19` / `ESR-Zone20`
  from endgame-map groups into Act 1 groups), so `terrorZones.watchedZoneSet` keeps the `zoneSetFingerprint` of the
  groups the list was starred against: the zone count and an FNV-1a hash of every group's id and area ids in file order
  (not the labels, seed, start or durations). When a bundle loads (`scheduleStore`, before anything renders it)
  `syncWatchedZoneSet` compares it: a different or missing fingerprint with a non-empty list clears the list once
  (`reconcileWatched`; a missing one means a list starred with ESR 3.2.24, before the key existed), then the new
  fingerprint is stored. Any release that adds or moves an area clears every star, not only the changed groups'.
- Watched groups are highlighted with the `warning` token (`WATCHED_ROW_CLASS`: brown-orange in light, yellow in dark)
  and the favourites' amber star.
- **Notifications** (opt-in, `terrorZones.notify`): the page's toggle asks for permission on the click only, then shows
  a confirmation ("Terror zone notifications are on"). Denied, or a browser without the API or whose
  `new Notification()` throws (Android Chrome and home-screen apps: "Illegal constructor" outside a service worker),
  shows a hint and stays off. The permission is re-read when it changes in the site settings (`navigator.permissions`
  `change`, and on every return to the tab). The widget sends "Watched terror zone started" when the slot changes to a
  watched group while a tab is open (`useTerrorZoneNotifications`; never for the slot the page opened in, and not more
  than 5 minutes after the start: a tab that slept or was frozen stays quiet). No push service: closed tabs get
  nothing. Two open tabs: the first writes `terrorZones.lastNotifiedStart` (the slot's start, Unix seconds, so a
  config with a later start whose slot numbers restart is not blocked) and the notification `tag` is the slot's start,
  so at most one shows.

## Clock

`store/clock.ts` is the one ticking clock: every second while the tab is visible, every 30 s while it is hidden
(`visibilitychange`), and only while something subscribes. `useNow()` re-renders every tick and is used only by the
`Countdown` component; `useClockValue(select)` re-renders when the selected value changes, so `useCurrentSlots`
(current and next window) re-renders once per slot and the zone list's "in 3 h" once per minute.

## Tests

Logic only: `engine/sha1.test.ts`, `engine/schedule.test.ts` (retail ground truth, the ESR bundle's consistency, cache,
edges: before the start, breaks, an end time), `utils/utils.test.ts` (countdown and wait formatting, watched alert /
filter / toggle, zone-set fingerprint and watch-list reset, notification decision, boost summary, widget lift),
`store/preferences.test.ts` (the stored watch list cleared once when the fingerprint changes), `build/bundleTerrorZones.test.ts` (seed precision, names, duplicate
ids, invalid configs) and the committed-bundle checks in `bundleIntegrity.test.ts`.
