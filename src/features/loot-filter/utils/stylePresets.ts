/**
 * Ready-made styles in the spirit of Sully's PoE-like labels: a name colour (a `ÿc` code before `{name}` in
 * `replaceName`), a label background and a border, sometimes a droplight. The Styles tab adds them ("Add preset") and the
 * example rules dialog offers them per rule. A preset holds the look only: sound, minimap icon and chat line stay on the
 * rule, so the dialog's "No sounds" / "No chat messages" / "No minimap icons" switches really switch them all off.
 *
 * Adding a preset copies it into the filter's `styles` under `name`. When the filter already has a style of that name,
 * the filter's own style is kept and reused, never overwritten (`presetStyleStatus`).
 */
import type { LootFilterStyle } from '../engine/types';

export type StylePresetId =
  | 'high-rune'
  | 'mid-rune'
  | 'low-rune'
  | 'unique'
  | 'set'
  | 'mythical'
  | 'runeword-base'
  | 'good-charm'
  | 'good-jewel'
  | 'jewellery'
  | 'uber'
  | 'perfect-gem'
  | 'crafting'
  | 'rare-reagent'
  | 'coupon'
  | 'map'
  | 'valuable'
  | 'muted';

export interface StylePreset {
  readonly id: StylePresetId;
  /** The style's name in the filter (`styles` key and `useStyle` value). */
  readonly name: string;
  /** The menu label. */
  readonly label: string;
  /** What it is for, one line. */
  readonly description: string;
  /** A sample item name for the preview. */
  readonly sample: string;
  readonly style: LootFilterStyle;
}

const WHITE = [255, 255, 255, 255] as const;
const BLACK = [0, 0, 0, 255] as const;

/** Every preset, in menu order. */
export const STYLE_PRESETS: readonly StylePreset[] = [
  {
    id: 'high-rune',
    name: 'HighRune',
    label: 'High rune',
    description: 'Red name on a white plate, thick red border and a red beam: the drops worth stopping for.',
    sample: 'Ber Rune',
    style: {
      replaceName: 'ÿc1{name}',
      labelBackground: WHITE,
      labelBorder: { color: [240, 0, 0, 255], width: 2 },
      droplight: { color: [255, 40, 0] },
    },
  },
  {
    id: 'mid-rune',
    name: 'MidRune',
    label: 'Mid rune',
    description: 'Orange name on black with an orange border: good runes you still pick up.',
    sample: 'Ist Rune',
    style: { replaceName: 'ÿc8{name}', labelBackground: [0, 0, 0, 230], labelBorder: { color: [255, 168, 0, 255], width: 1 } },
  },
  {
    id: 'low-rune',
    name: 'LowRune',
    label: 'Low rune',
    description: 'Orange name, no box: easy to spot, easy to ignore.',
    sample: 'Tal Rune',
    style: { replaceName: 'ÿc8{name}' },
  },
  {
    id: 'unique',
    name: 'UniqueItem',
    label: 'Unique',
    description: 'Gold name on dark brown with an orange border.',
    sample: 'Harlequin Crest',
    style: { replaceName: 'ÿc4{name}', labelBackground: [40, 25, 0, 230], labelBorder: { color: [255, 165, 0, 255], width: 1 } },
  },
  {
    id: 'set',
    name: 'SetItem',
    label: 'Set',
    description: 'Green name on dark green with a green border.',
    sample: "Tal Rasha's Guardianship",
    style: { replaceName: 'ÿc2{name}', labelBackground: [0, 35, 0, 230], labelBorder: { color: [0, 255, 0, 255], width: 1 } },
  },
  {
    id: 'mythical',
    name: 'MythicalUnique',
    label: 'Mythical unique',
    description: 'Purple name on white, thick purple border and a purple beam: the rarest drops in ESR.',
    sample: 'Mythical Marksman Bow',
    style: {
      replaceName: 'ÿc;{name}',
      labelBackground: WHITE,
      labelBorder: { color: [174, 0, 255, 255], width: 2 },
      droplight: { color: [174, 0, 255] },
    },
  },
  {
    id: 'runeword-base',
    name: 'RunewordBase',
    label: 'Runeword base',
    description: 'Grey plate with a white border: a white or grey base with the sockets you want.',
    sample: 'Phase Blade',
    style: { labelBackground: [45, 45, 45, 230], labelBorder: { color: WHITE, width: 1 } },
  },
  {
    id: 'good-charm',
    name: 'GoodCharm',
    label: 'Good charm',
    description: 'Dark green plate with a green border: a charm with a stat worth checking.',
    sample: 'Grand Charm',
    style: { labelBackground: [0, 40, 20, 230], labelBorder: { color: [0, 200, 80, 255], width: 1 } },
  },
  {
    id: 'good-jewel',
    name: 'GoodJewel',
    label: 'Good jewel',
    description: 'Yellow name on black with a teal border (Sully’s rare jewel look).',
    sample: 'Jewel',
    style: { replaceName: 'ÿc9{name}', labelBackground: BLACK, labelBorder: { color: [0, 200, 200, 255], width: 1 } },
  },
  {
    id: 'jewellery',
    name: 'GoodJewellery',
    label: 'Good jewellery',
    description: 'A thick light blue border: rings, amulets and class jewellery worth identifying.',
    sample: 'Ring',
    style: { labelBorder: { color: [0, 160, 255, 255], width: 2 } },
  },
  {
    id: 'uber',
    name: 'UberItem',
    label: 'Uber key or organ',
    description: 'Purple name on black with a purple border (Sully’s Uber look): keys, organs, essences.',
    sample: 'Key of Terror',
    style: { replaceName: 'ÿc;{name}', labelBackground: [0, 0, 0, 200], labelBorder: { color: [165, 55, 253, 255], width: 1 } },
  },
  {
    id: 'perfect-gem',
    name: 'PerfectGem',
    label: 'Perfect gem',
    description: 'A thin gold border, the game’s own name colour.',
    sample: 'Perfect Ruby',
    style: { labelBorder: { color: [200, 150, 0, 255], width: 1 } },
  },
  {
    id: 'crafting',
    name: 'CraftingReagent',
    label: 'Crafting reagent',
    description: 'Orange name with a thin gold border: body parts, crystals and other cube ingredients.',
    sample: 'Heart',
    style: { replaceName: 'ÿc8{name}', labelBorder: { color: [200, 150, 0, 255], width: 1 } },
  },
  {
    id: 'rare-reagent',
    name: 'RareReagent',
    label: 'Rare reagent (gold plate)',
    description: 'Black name on a gold plate (Sully’s GoldPlate): rare cube reagents and large gold piles.',
    sample: 'Maple Leaf',
    style: { replaceName: 'ÿc6{name}', labelBackground: [200, 150, 0, 255], labelBorder: { color: BLACK, width: 1 } },
  },
  {
    id: 'coupon',
    name: 'CouponItem',
    label: 'Coupon',
    description: 'Gold name with an orange border: Ancient Coupons you cube into uniques.',
    sample: 'Ancient Coupon (Shako, Harlequin Crest)',
    style: { replaceName: 'ÿc4{name}', labelBorder: { color: [255, 165, 0, 255], width: 1 } },
  },
  {
    id: 'map',
    name: 'MapItem',
    label: 'Map',
    description: 'White name on black with a white border (Sully’s map look).',
    sample: 'Chaos Rift (Tier 2)',
    style: { replaceName: 'ÿc0{name}', labelBackground: BLACK, labelBorder: { color: WHITE, width: 1 } },
  },
  {
    id: 'valuable',
    name: 'ValuableDrop',
    label: 'Valuable',
    description: 'Red name on white with a red border: anything rare and valuable that has no look of its own.',
    sample: "Lilith's Crystallized Tear",
    style: { replaceName: 'ÿc1{name}', labelBackground: WHITE, labelBorder: { color: [255, 0, 0, 255], width: 1 } },
  },
  {
    id: 'muted',
    name: 'MutedJunk',
    label: 'Muted',
    description: 'Grey name on a faint box: shown, but out of the way (the soft alternative to hiding).',
    sample: 'Short Sword',
    style: { replaceName: 'ÿc5{name}', labelBackground: [0, 0, 0, 120] },
  },
];

const BY_ID: ReadonlyMap<StylePresetId, StylePreset> = new Map(STYLE_PRESETS.map((preset) => [preset.id, preset]));

/** The preset with this id. */
export function stylePreset(id: StylePresetId): StylePreset {
  const preset = BY_ID.get(id);
  if (preset === undefined) throw new Error(`Unknown style preset ${id}`);
  return preset;
}

/** A value with its object keys sorted (arrays keep their order), for comparing styles regardless of key order. */
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonical((value as Record<string, unknown>)[key])])
    );
  }
  return value;
}

/** True when two styles hold the same keys and values (key order ignored). */
export function sameStyle(a: LootFilterStyle, b: LootFilterStyle): boolean {
  return JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
}

/**
 * Whether the filter's styles already hold a preset: `missing` (adding copies it in), `same` (an identical style of
 * that name is there) or `different` (a style of that name with other content: it is kept and reused, never
 * overwritten).
 */
export function presetStyleStatus(
  styles: Readonly<Record<string, LootFilterStyle>> | undefined,
  preset: Pick<StylePreset, 'name' | 'style'>
): 'missing' | 'same' | 'different' {
  if (styles === undefined || !Object.hasOwn(styles, preset.name)) return 'missing';
  return sameStyle(styles[preset.name], preset.style) ? 'same' : 'different';
}

/** The label preview text of a preset: its `replaceName` (or `{name}`) with the sample name in place of `{name}`. */
export function presetPreviewText(preset: StylePreset): string {
  const name = typeof preset.style.replaceName === 'string' ? preset.style.replaceName : '{name}';
  return name.replaceAll('{name}', preset.sample);
}
