/**
 * Typed model of an ESR loot filter file (formatVersion 1), as documented in the author's
 * "ESR Loot Filter Guide" (builds-feature-docs/loot-filter/). This is the contract shared by the
 * parser, serializer, validator, evaluator and the editor UI.
 *
 * Design rules:
 * - Every known key is typed exactly as the plugin reads it; optional keys are `undefined` when absent.
 * - Keys the editor does not know, and known keys whose value had the wrong shape, are kept in
 *   `passthrough` so an uploaded filter survives a download unchanged apart from edits. Serialization
 *   writes typed keys first and then passthrough keys; a passthrough entry whose name is a known key is
 *   written only when the typed field is `undefined` (the user fixed it in a form, or never did).
 */

// ---------------------------------------------------------------------------
// Enumerations from the guide
// ---------------------------------------------------------------------------

export const LANGUAGES = ['enUS', 'deDE', 'esES', 'frFR', 'itIT', 'koKR', 'plPL', 'ruRU', 'zhCN', 'zhTW', 'esMX', 'jaJP', 'ptBR'] as const;
export type Language = (typeof LANGUAGES)[number];

/** Item qualities in plugin order; the number form is the 1-based position (inferior = 1 … tempered = 9). */
export const QUALITIES = ['inferior', 'normal', 'superior', 'magic', 'set', 'rare', 'unique', 'crafted', 'tempered'] as const;
export type QualityName = (typeof QUALITIES)[number];

/** Base tiers; the number form is the 0-based position (normal = 0, exceptional = 1, elite = 2). */
export const BASE_TIERS = ['normal', 'exceptional', 'elite'] as const;
export type BaseTierName = (typeof BASE_TIERS)[number];

/** Game difficulties; the number form is the 0-based position. */
export const DIFFICULTIES = ['normal', 'nightmare', 'hell'] as const;
export type DifficultyName = (typeof DIFFICULTIES)[number];

/** Where a rule looks at items. A rule without `location` looks at `onGround` only. */
export const LOCATIONS = ['onGround', 'stored', 'equipped', 'atVendor'] as const;
export type ItemLocation = (typeof LOCATIONS)[number];

/** Stat check operators; `>=` is the default when `op` is absent; `between` needs `value: [low, high]`. */
export const STAT_OPS = ['==', '!=', '>', '>=', '<', '<=', 'between'] as const;
export type StatOp = (typeof STAT_OPS)[number];

export const FORMAT_VERSION = 1;

// ---------------------------------------------------------------------------
// Value shapes
// ---------------------------------------------------------------------------

/** Per-language text; a missing language falls back to enUS. */
export type LocalizedText = Partial<Readonly<Record<Language, string>>>;
/** Any text the plugin prints: one string or one string per language. */
export type FilterText = string | LocalizedText;

/** A number condition: one value, a list of alternatives, or an inclusive range. */
export interface NumberRange {
  readonly min?: number;
  readonly max?: number;
}
export type NumberMatch = number | readonly number[] | NumberRange;

/** A named value accepts the name or its number (see the enumerations above for the numbering). */
export type NamedValue<N extends string> = N | number;
export interface NamedRange<N extends string> {
  readonly min?: NamedValue<N>;
  readonly max?: NamedValue<N>;
}
export type NamedMatch<N extends string> = NamedValue<N> | readonly NamedValue<N>[] | NamedRange<N>;

/** `{ "stat": "item_numsockets", "param": 0, "op": ">=", "value": 2 }`; `stat` is an itemstatcost.txt name or id. */
export interface StatCheck {
  readonly stat: string | number;
  readonly param?: number;
  readonly op?: StatOp;
  /** A number, or `[low, high]` when `op` is `between`. */
  readonly value: number | readonly [number, number];
}

export type RgbColor = readonly [number, number, number];
export type RgbaColor = readonly [number, number, number, number];
/** `[r, g, b]` or `[r, g, b, a]`, each 0 to 255. */
export type LabelColor = RgbColor | RgbaColor;

/** Alpha the plugin uses for `labelBackground` given as `[r, g, b]`. */
export const DEFAULT_LABEL_BACKGROUND_ALPHA = 242;

export interface LabelBorder {
  readonly color: LabelColor;
  readonly width: number;
}

export interface MinimapIcon {
  /** A `.sprite` file in the filter's `icons` folder; the extension may be left off. Only the first frame is drawn. */
  readonly iconName: string;
  /** 4 to 256: the longer side in minimap pixels; absent = the file's own size. */
  readonly iconSize?: number;
  /** Optional tint; a fourth number fades the icon. */
  readonly color?: LabelColor;
}

export interface Droplight {
  /** Optional beam colour; `{}` keeps the game's white beam. */
  readonly color?: RgbColor;
}

export interface FilterLevel {
  readonly id: number;
  readonly name: string;
}

export interface Notifications {
  /** The drop line printed by `notify: true`. Default `{qualityColor}{name}`. */
  readonly dropFormat?: FilterText;
  /** Printed when the level changes; takes `{level}` and `{filter}`. Default `ÿc4Loot filter level: ÿc0{level}`. */
  readonly levelChangeFormat?: FilterText;
}

/** One colour code (`ÿc` + one character) per quality. */
export type QualityColors = Partial<Readonly<Record<QualityName, string>>>;

/** Keys the editor does not know, or known keys whose value had the wrong shape, carried through unchanged. */
export type Passthrough = Readonly<Record<string, unknown>>;

// ---------------------------------------------------------------------------
// Rules and styles
// ---------------------------------------------------------------------------

export interface RuleConditions {
  readonly itemCodes?: readonly string[];
  readonly excludeItemCodes?: readonly string[];
  /** itemtypes.txt codes; parent types match too. */
  readonly itemTypes?: readonly string[];
  readonly excludeItemTypes?: readonly string[];
  readonly quality?: NamedMatch<QualityName>;
  readonly baseTier?: NamedMatch<BaseTierName>;
  /** 0 to 999 */
  readonly itemLevel?: NumberMatch;
  /** 0 to 99 */
  readonly sockets?: NumberMatch;
  /** 0 to 99: the most sockets the base can have */
  readonly maxSockets?: NumberMatch;
  readonly isFullySocketed?: boolean;
  readonly isEthereal?: boolean;
  readonly isIdentified?: boolean;
  readonly isRuneword?: boolean;
  /** Row numbers in uniqueitems.txt or setitems.txt */
  readonly uniqueOrSetIds?: readonly number[];
  readonly excludeUniqueOrSetIds?: readonly number[];
  readonly itemStats?: readonly StatCheck[];
  readonly itemStatsAnyOf?: readonly StatCheck[];
  readonly playerStats?: readonly StatCheck[];
  readonly playerStatsAnyOf?: readonly StatCheck[];
  readonly location?: readonly ItemLocation[];
  readonly difficulty?: NamedMatch<DifficultyName>;
  /** levels.txt Id numbers */
  readonly areas?: readonly number[];
  readonly excludeAreas?: readonly number[];
  /** Filter level ids; absent = active at every level */
  readonly activeInLevels?: readonly number[];
}

export interface RuleActions {
  /** Hides the ground label; no later rule runs. */
  readonly hide?: boolean;
  /** When codes, types and location match but another condition fails, the item is hidden. */
  readonly hideIfOtherConditionsFail?: boolean;
  readonly replaceName?: FilterText;
  readonly namePrefix?: FilterText;
  readonly nameSuffix?: FilterText;
  readonly labelBackground?: LabelColor;
  readonly labelBorder?: LabelBorder;
  readonly chatMessage?: FilterText;
  readonly chatMessageWhenHidden?: FilterText;
  /** Prints the filter's drop line (`notifications.dropFormat`). */
  readonly notify?: boolean;
  /** A sounds.txt Sound name or row number, or a .wav/.mp3/.flac file in the filter's `sounds` folder. */
  readonly sound?: string | number;
  /** 0 to 100 */
  readonly soundVolume?: number;
  readonly icon?: MinimapIcon;
  readonly droplight?: Droplight;
  /** Name of an entry in the filter's `styles`; the rule's own actions win over the style's. */
  readonly useStyle?: string;
  /** Ignored by the plugin; notes for the author. */
  readonly comment?: string;
}

export interface LootFilterRule extends RuleConditions, RuleActions {
  readonly passthrough?: Passthrough;
  /**
   * Editor-only, never a key inside the rule: the format has no enable flag, so a disabled rule is written to the
   * top-level `disabledRules` list (`{ "at": <index in the full rule list>, "rule": {…} }`) that the plugin ignores.
   */
  readonly disabled?: true;
}

/** A named set of actions that rules pull in with `useStyle`. Styles hold actions only. */
export interface LootFilterStyle extends RuleActions {
  readonly passthrough?: Passthrough;
}

// ---------------------------------------------------------------------------
// The filter file
// ---------------------------------------------------------------------------

export interface LootFilter {
  readonly formatVersion: number;
  readonly title?: string;
  readonly author?: string;
  readonly version?: string;
  readonly description?: string;
  /** Where newer copies of the filter are published. */
  readonly updateUrl?: string;
  readonly filterLevels?: readonly FilterLevel[];
  readonly defaultLevel?: number;
  /** `true` hides every ground item no rule matched. */
  readonly hideUnmatchedItems?: boolean;
  /** 0 to 100, the volume for rules that set none. */
  readonly soundVolume?: number;
  readonly notifications?: Notifications;
  readonly qualityColors?: QualityColors;
  /** Insertion order is the file order. */
  readonly styles?: Readonly<Record<string, LootFilterStyle>>;
  /** Every rule in editor order, disabled ones included (they are written to `disabledRules`, see `LootFilterRule.disabled`). */
  readonly rules: readonly LootFilterRule[];
  /** The `//` comment lines that precede the JSON object, verbatim (without the line break). */
  readonly leadingComments: readonly string[];
  readonly passthrough?: Passthrough;
}

// ---------------------------------------------------------------------------
// Diagnostics
// ---------------------------------------------------------------------------

export type DiagnosticSeverity = 'error' | 'warning';

export interface Diagnostic {
  readonly severity: DiagnosticSeverity;
  readonly message: string;
  /**
   * Slash-separated path into the file, e.g. `rules/12/itemCodes/3` or `styles/Mythical/sound`. A rule's path is its
   * place in the written file (`ruleFilePaths`): `rules/<n>` counts enabled rules only, a disabled rule is
   * `disabledRules/<n>/rule`; `rule` is the index in the editor's full list either way.
   */
  readonly path: string;
  /** Index of the rule the diagnostic belongs to, when it is a rule's. */
  readonly rule?: number;
  /** Name of the style the diagnostic belongs to, when it is a style's. */
  readonly style?: string;
}

/**
 * Game data the validator and editor check names against. Built from the `lootfilter.json` and
 * `types.json` bundles; every set may be empty when the bundles are not loaded (then nothing is checked).
 */
export interface LootFilterReference {
  readonly itemCodes: ReadonlySet<string>;
  readonly itemTypes: ReadonlySet<string>;
  readonly statNames: ReadonlySet<string>;
  readonly statIds: ReadonlySet<number>;
  /** Stat id → itemstatcost name (to know a layered stat written by id). */
  readonly statNamesById: ReadonlyMap<number, string>;
  /** Skill tab layer (`class << 3 | tab`) → "Assassin Martial Arts", for the param warnings. */
  readonly skillTabNames: ReadonlyMap<number, string>;
  readonly areaIds: ReadonlySet<number>;
  readonly soundNames: ReadonlySet<string>;
  /** Number of rows in sounds.txt (a `sound` row number must be below it). */
  readonly soundRowCount: number;
  readonly uniqueOrSetIds: ReadonlySet<number>;
  /** Item code → the ancestors of its `type` and `type2` (each including itself), for the "never matches" checks. */
  readonly itemCodeTypes: ReadonlyMap<string, ReadonlySet<string>>;
  /** Item type → its ancestors, including itself. */
  readonly typeAncestors: ReadonlyMap<string, ReadonlySet<string>>;
}
