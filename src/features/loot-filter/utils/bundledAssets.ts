import type { MinimapIcon } from '../engine/types';
import { lootFilterAssetUrl } from './template';

/**
 * The registry of sound and minimap icon files the app bundles under `public/loot-filters/` (`sounds/`, `icons/`). The
 * editor previews them, the pickers (sound field, icon field, example rules, style presets) offer them, and the .zip
 * download copies every one a filter references next to it. Any other file lives only in the user's own filter folder.
 *
 * To add one: drop the file into `public/loot-filters/sounds/` (`.mp3`, `.wav` or `.flac`) or
 * `public/loot-filters/icons/` (`.sprite`; shrink it to 128 px like the others, see docs/features/LOOT-FILTER.md), then add
 * one line below. bundledAssets.test.ts fails while a file and the registry disagree.
 *
 * The sounds and the first twelve icons come from Sully's QoL filter (github.com/Thisisnotsully/QoL-Filter); their
 * descriptions say where his filter uses each one, the clearest guide to what it is for. The `<shape>_<colour>` icons
 * after them are drawn for this app by scripts/generate-loot-filter-icons.ts in the style presets' colours (their notes
 * name the preset each one pairs with); change them there and regenerate (`npm run loot-filter:icons`), never by hand.
 */

export interface BundledSoundAsset {
  /** The file name in `public/loot-filters/sounds/`, in the file's own case; also the `sound` value rules write. */
  readonly file: string;
  /** A short name for pickers. */
  readonly label: string;
  /** When to use it, one short sentence. */
  readonly use: string;
  readonly credit: string;
}

export interface BundledIconAsset {
  /**
   * The file name without `.sprite`, in the file's own case (the app's server is case-sensitive; the plugin's Windows file
   * system is not, so a rule's `gemp` loads `gemP.sprite`); also the `iconName` rules write.
   */
  readonly name: string;
  readonly label: string;
  readonly use: string;
  readonly credit: string;
  /**
   * The folder also has `<name>.lowend.sprite` (the mod's own file for the game's low graphics setting); the zip carries
   * it along. The plugin does not need it: it registers its own low graphics copy of the .sprite (see LOOT-FILTER.md).
   */
  readonly lowend?: true;
}

const SULLY = "Sully (Sully's QoL filter)";
const GENERATED = 'Generated for this app';

const sound = (file: string, label: string, use: string): BundledSoundAsset => ({ file, label, use, credit: SULLY });
const icon = (name: string, label: string, use: string, extra: Partial<Pick<BundledIconAsset, 'lowend'>> = {}): BundledIconAsset => ({
  name,
  label,
  use,
  credit: SULLY,
  ...extra,
});
/** A generated icon (scripts/generate-loot-filter-icons.ts); the plugin makes the low graphics copy itself, so none has a `lowend` file. */
const generated = (name: string, label: string, use: string): BundledIconAsset => ({ name, label, use, credit: GENERATED });

/** Every bundled sound, in picker order. */
export const BUNDLED_SOUND_ASSETS: readonly BundledSoundAsset[] = [
  sound('tink.mp3', 'Tink', 'Jackpot drops: high runes, ESR runes, legendary materials.'),
  sound('tinkLOUD.mp3', 'Tink (loud)', 'A louder tink for the drops you must never miss.'),
  sound('mid.mp3', 'Mid', 'Good but common drops: Mal to Gul runes, Socket Donuts, Worldstone Shards.'),
  sound('other.mp3', 'Other', 'Notable drops: rare jewels, +All Skills bases, unique jewellery, big gold piles.'),
  sound('unique.mp3', 'Unique', 'Unique and set items.'),
  sound('mythical.mp3', 'Mythical', 'Mythical uniques, the rarest drops.'),
  sound('gong.mp3', 'Gong', 'Uber keys, organs and essences; rare crafting reagents.'),
  sound('map.mp3', 'Map', 'Tier 2 to 4 maps.'),
  sound('t5_map.mp3', 'Tier 5 map', 'Tier 5 maps.'),
];

/** Every bundled minimap icon, in picker order; the first is the editor's default icon. */
export const BUNDLED_ICON_ASSETS: readonly BundledIconAsset[] = [
  icon('goldstar', 'Gold star', 'Uniques and other valuable drops.', { lowend: true }),
  icon('star', 'Star', 'Set items.'),
  icon('Myth', 'Mythical', 'Mythical uniques.'),
  icon('rune', 'Rune', 'Runes.'),
  icon('gem', 'Gem', 'Jewels.'),
  icon('gem2', 'Gem (alt)', 'Perfect gems and rune crystals.'),
  icon('gemP', 'Gem (purple)', 'Uber keys, organs and essences.'),
  icon('charm', 'Charm', 'Charms.'),
  icon('cube', 'Cube', 'Crafting reagents (body parts).'),
  icon('redD', 'Red diamond', 'Rare crafting materials.'),
  icon('scroll', 'Scroll', 'Coupons and scrolls.'),
  icon('map', 'Map', 'Maps.'),
  generated('star_gold', 'Gold star (shape)', 'Unique items; pairs with the Unique preset.'),
  generated('crown_gold', 'Gold crown', 'The uniques worth the most; pairs with the Unique preset.'),
  generated('star_green', 'Green star', 'Set items; pairs with the Set preset.'),
  generated('star_purple', 'Purple star', 'Mythical uniques; pairs with the Mythical unique preset.'),
  generated('crown_purple', 'Purple crown', 'The rarest mythical uniques; pairs with the Mythical unique preset.'),
  generated('diamond_red', 'Red diamond (shape)', 'High runes; pairs with the High rune preset.'),
  generated('diamond_orange', 'Orange diamond', 'Mid runes; pairs with the Mid rune preset.'),
  generated(
    'triangle_orange',
    'Orange triangle',
    'Low runes and other minor drops; matches the Low rune preset (which has no icon itself).'
  ),
  generated('cross_red', 'Red cross', 'Anything rare and valuable without an icon of its own; pairs with the Valuable preset.'),
  generated('shield_white', 'Socketed shield', 'Runeword bases with the sockets you want; pairs with the Runeword base preset.'),
  generated('square_emerald', 'Green square', 'Charms worth checking; pairs with the Good charm preset.'),
  generated('hexagon_teal', 'Teal hexagon', 'Jewels; pairs with the Good jewel preset (its teal border).'),
  generated('hexagon_yellow', 'Yellow hexagon', 'Rare jewels; pairs with the Good jewel preset (its yellow name).'),
  generated('ring_blue', 'Blue ring', 'Rings, amulets and class jewellery; pairs with the Good jewellery preset.'),
  generated('skull_purple', 'Purple skull', 'Uber organs and essences; pairs with the Uber key or organ preset.'),
  generated('key_purple', 'Purple key', 'Uber keys; pairs with the Uber key or organ preset.'),
  generated('gem_gold', 'Gold gem', 'Perfect gems; pairs with the Perfect gem preset.'),
  generated('flame_orange', 'Orange flame', 'Crafting reagents; pairs with the Crafting reagent preset.'),
  generated('coin_gold', 'Gold coin', 'Rare reagents and large gold piles; pairs with the Rare reagent (gold plate) preset.'),
  generated('scroll_gold', 'Gold scroll', 'Ancient Coupons; pairs with the Coupon preset.'),
  generated('map_white', 'White map', 'Maps; pairs with the Map preset.'),
  generated('circle_grey', 'Grey dot', 'Drops you keep visible but quiet; matches the Muted preset (which has no icon itself).'),
  generated('star_white', 'White star', 'Any colour: set the icon tint (it multiplies the colours).'),
  generated('diamond_white', 'White diamond', 'Any colour: set the icon tint (it multiplies the colours).'),
  generated('circle_white', 'White dot', 'Any colour: set the icon tint (it multiplies the colours).'),
];

/** The bundled sound file names, in picker order. */
export const BUNDLED_SOUNDS: readonly string[] = BUNDLED_SOUND_ASSETS.map((asset) => asset.file);

/** The bundled icon names (without `.sprite`), in picker order; the first is the editor's default icon. */
export const BUNDLED_ICONS: readonly string[] = BUNDLED_ICON_ASSETS.map((asset) => asset.name);

/** True for an icon drawn for this app (scripts/generate-loot-filter-icons.ts), false for Sully's. */
export function isGeneratedIcon(asset: BundledIconAsset): boolean {
  return asset.credit === GENERATED;
}

/** What ticking Minimap icon gives a rule or style without one: the white star (tint it any colour) at 40 minimap pixels. */
export const DEFAULT_ICON = { iconName: 'star_white', iconSize: 40 } as const satisfies MinimapIcon;

/** The bundled sound file a `sound` value names (the plugin's file names are case-insensitive), or undefined. */
export function findBundledSound(sound: string | number | undefined): string | undefined {
  return findBundledSoundAsset(sound)?.file;
}

/** The registry entry of the bundled sound a `sound` value names, or undefined. */
export function findBundledSoundAsset(sound: string | number | undefined): BundledSoundAsset | undefined {
  if (typeof sound !== 'string') return undefined;
  const lower = sound.trim().toLowerCase();
  return BUNDLED_SOUND_ASSETS.find((asset) => asset.file.toLowerCase() === lower);
}

/** The bundled icon file an `iconName` names, with or without `.sprite` and in any case (in the file's case), or undefined. */
export function findBundledIcon(iconName: string | undefined): string | undefined {
  return findBundledIconAsset(iconName)?.name;
}

/** The registry entry of the bundled icon an `iconName` names (any case, `.sprite` optional), or undefined. */
export function findBundledIconAsset(iconName: string | undefined): BundledIconAsset | undefined {
  if (iconName === undefined) return undefined;
  const lower = iconName
    .trim()
    .toLowerCase()
    .replace(/\.sprite$/, '');
  return BUNDLED_ICON_ASSETS.find((asset) => asset.name.toLowerCase() === lower);
}

export function bundledSoundUrl(name: string): string {
  return lootFilterAssetUrl(`sounds/${encodeURIComponent(name)}`);
}

export function bundledIconUrl(name: string): string {
  return lootFilterAssetUrl(`icons/${encodeURIComponent(name)}.sprite`);
}

/** A `sound` value for display: a name as written, a number as its sounds.txt row (with the row's name when known). */
export function soundLabel(sound: string | number, soundNames: readonly string[]): string {
  if (typeof sound === 'string') return sound;
  const name = sound >= 0 ? (soundNames.at(sound) ?? '') : '';
  return name === '' ? `sounds.txt row ${String(sound)}` : `sounds.txt row ${String(sound)} (${name})`;
}
