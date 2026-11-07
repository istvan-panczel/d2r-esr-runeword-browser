/**
 * FORMAT.md, examples.md and assets.md of the LLM prompt package. As much as possible comes from the editor's own
 * sources so the text follows the code: the key lists (`TOP_LEVEL_KEYS`, `CONDITION_KEYS`, `ACTION_KEYS`, typed
 * exhaustively below so a new key does not compile without a description), the enumerations, `STAT_OPS`,
 * `PLACEHOLDERS`, `COLOR_CODES`, `STAT_QUIRKS`, `STAT_SCALES`, `STAT_LAYER_KINDS`, `OMITTED_PARAM_RULE`, the example
 * rules, the bundled sounds and icons, and the validator itself: "Common mistakes" runs `readLootFilter` and
 * `validateLootFilter` on small wrong rules and prints what the app reports. Prose is only for semantics.
 */
import { STAT_LAYER_KINDS, type StatLayerKind } from '@/features/game-data/engine/statLayers';
import { COLOR_CODES } from '../../engine/colors';
import { OMITTED_PARAM_RULE } from '../../engine/evaluate';
import { ACTION_KEYS, CONDITION_KEYS, readLootFilter, TOP_LEVEL_KEYS } from '../../engine/parse';
import { serializeLootFilter, toPlainJson } from '../../engine/serialize';
import { STAT_QUIRKS } from '../../engine/statQuirks';
import { STAT_SCALES } from '../../engine/statScale';
import { PLACEHOLDERS, type PlaceholderContext } from '../../engine/text';
import {
  BASE_TIERS,
  DEFAULT_LABEL_BACKGROUND_ALPHA,
  DIFFICULTIES,
  FORMAT_VERSION,
  LANGUAGES,
  LOCATIONS,
  QUALITIES,
  STAT_OPS,
  type LootFilter,
  type LootFilterReference,
  type LootFilterRule,
  type LootFilterStyle,
  type RuleActions,
  type RuleConditions,
} from '../../engine/types';
import { validateLootFilter } from '../../engine/validate';
import { FILTER_CONTENT_MAX_BYTES } from '../../sharing/constants';
import { BUNDLED_ICON_ASSETS, BUNDLED_SOUND_ASSETS } from '../bundledAssets';
import { buildExampleSet, defaultChoices, EXAMPLE_GROUPS, type ExampleRule } from '../exampleRules';
import { STYLE_PRESETS } from '../stylePresets';
import { LOOT_FILTER_PLUGIN_VERSION } from '../template';

/** The bundled sound and icon files the prompt offers (the zip download of a filter ships these). */
export interface PromptAssets {
  /** Sound file names as a rule writes them (`tink.mp3`). */
  readonly sounds: readonly PromptAsset[];
  /** Icon names as a rule writes them (`goldstar`, without `.sprite`). */
  readonly icons: readonly PromptAsset[];
}

export interface PromptAsset {
  readonly name: string;
  /** What it sounds or looks like, when known. */
  readonly note?: string;
}

/** The files bundled today (`utils/bundledAssets.ts`), each with its "when to use" line. */
export const DEFAULT_PROMPT_ASSETS: PromptAssets = {
  sounds: BUNDLED_SOUND_ASSETS.map((asset) => ({ name: asset.file, note: asset.use })),
  icons: BUNDLED_ICON_ASSETS.map((asset) => ({ name: asset.name, note: asset.use })),
};

/** A ready-made style the prompt shows in examples.md. */
export interface PromptStylePreset {
  readonly name: string;
  readonly description?: string;
  readonly style: LootFilterStyle;
}

/** The editor's style presets (`utils/stylePresets.ts`), the ones the example rules use. */
export const DEFAULT_PROMPT_STYLE_PRESETS: readonly PromptStylePreset[] = STYLE_PRESETS.map(({ name, description, style }) => ({
  name,
  description,
  style,
}));

const code = (text: string) => `\`${text}\``;
const list = (values: readonly string[]) => values.map(code).join(', ');
const json = (value: unknown) => JSON.stringify(value);

/** A markdown table; cells have their pipes escaped. */
export function markdownTable(header: readonly string[], rows: readonly (readonly string[])[]): string {
  const cell = (text: string) => text.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
  const line = (cells: readonly string[]) => `| ${cells.map(cell).join(' | ')} |`;
  return [line(header), line(header.map(() => '---')), ...rows.map(line)].join('\n');
}

// --- Keys ---

type TopLevelKey = (typeof TOP_LEVEL_KEYS)[number];

const TOP_LEVEL: Readonly<Record<TopLevelKey, string>> = {
  formatVersion: `Always ${String(FORMAT_VERSION)}. Required.`,
  title: 'The filter name the launcher shows.',
  author: 'Shown in the launcher.',
  version: 'Shown in the launcher, e.g. "1.0.0".',
  description: 'One or two sentences the launcher shows.',
  updateUrl: 'Where newer copies are published. Leave it out.',
  filterLevels:
    'Strictness levels, `[{ "id": 1, "name": "Leveling" }, { "id": 2, "name": "Strict" }]`; whole-number ids, unique. A name is a string or a per-language object like any text.',
  defaultLevel: 'The level id a new player starts on; must be one of the filterLevels ids.',
  hideUnmatchedItems: '`true` hides every ground item no rule matched. Very strict; leave it out unless the user wants it.',
  soundVolume: '0 to 100: the volume for rules that set none.',
  notifications: '`{ "dropFormat": text, "levelChangeFormat": text }`: the drop line `notify` prints and the level change line.',
  qualityColors: `Name colour per quality, \`{ "magic": "ÿc3" }\`; keys ${list(QUALITIES)}, values one colour code.`,
  styles: 'Named sets of actions, `{ "Valuable": { …actions… } }`; rules pull one in with `useStyle`. Styles hold actions only.',
  rules: 'The list of rules, applied top to bottom. Required.',
  disabledRules:
    'The app keeps switched-off rules here as `[{ "at": <index>, "rule": {…} }]`; the plugin ignores it. Do not write it unless the user asks.',
};

const NUMBER = 'one number, a list of alternatives or { "min", "max" }';
const NAMED = 'the name or its number; one, a list or { "min", "max" }';

const CONDITIONS: Readonly<Record<keyof RuleConditions, readonly [value: string, holds: string]>> = {
  itemCodes: ['item codes, e.g. `["r51", "uap"]` (items.csv, bases.csv)', "the item's code is listed"],
  excludeItemCodes: ['item codes', "the item's code is not listed"],
  itemTypes: ['item type codes, e.g. `["rune", "weap"]` (item-types.csv)', 'the item is of a listed type or of a child type of one'],
  excludeItemTypes: ['item type codes', 'the item is of none of them (child types included)'],
  quality: [`${list(QUALITIES)} (1 to 9); ${NAMED}`, "the item's quality matches"],
  baseTier: [
    `${list(BASE_TIERS)} (0 to 2); ${NAMED}`,
    'the base tier matches; items without a tier family (rings, amulets, charms, jewels, misc) may not match, not verified',
  ],
  itemLevel: [`0 to 999; ${NUMBER}`, 'the item level matches'],
  sockets: [`0 to 99; ${NUMBER}`, 'the sockets the item has now match'],
  maxSockets: [`0 to 99; ${NUMBER}`, 'the most sockets its base can have matches (for bases the player sockets later)'],
  isFullySocketed: ['true or false', 'the item is (not) fully socketed'],
  isEthereal: ['true or false', 'the item is (not) ethereal'],
  isIdentified: ['true or false', 'the item is (not) identified'],
  isRuneword: ['true or false', 'the item is (not) a runeword'],
  uniqueOrSetIds: ['unique or set row ids, e.g. `[418, 973]` (uniques-sets.csv)', 'the unique or set item is listed'],
  excludeUniqueOrSetIds: ['unique or set row ids', 'the unique or set item is not listed'],
  itemStats: ['stat checks', 'every check holds for the item (AND)'],
  itemStatsAnyOf: ['stat checks', 'at least one check holds for the item (OR)'],
  playerStats: ['stat checks', "every check holds for the player's character"],
  playerStatsAnyOf: ['stat checks', "at least one check holds for the player's character"],
  location: [`a list of ${list(LOCATIONS)}`, 'the item is there; without the key a rule looks at onGround only'],
  difficulty: [`${list(DIFFICULTIES)} (0 to 2); ${NAMED}`, "the game's difficulty matches"],
  areas: ['area ids, e.g. `[39]` (areas.csv)', 'the player is in one of those areas'],
  excludeAreas: ['area ids', 'the player is in none of those areas'],
  activeInLevels: [
    'filter level ids, e.g. `[2, 3]`',
    'the filter is at one of those levels; without the key the rule works at every level',
  ],
};

const COLOR = '`[r, g, b]` or `[r, g, b, a]`, whole numbers 0 to 255';

const ACTIONS: Readonly<Record<keyof RuleActions, readonly [value: string, effect: string]>> = {
  hide: ['true', 'Hides the ground label (the item cannot be picked up by clicking its label); no later rule runs for the item.'],
  hideIfOtherConditionsFail: [
    'true',
    'When the codes, types and location match but any other condition fails, the item is hidden (see "Hide rules").',
  ],
  replaceName: ['text', 'A new name. `{name}` is the game name.'],
  namePrefix: ['text', 'Text before the name.'],
  nameSuffix: ['text', 'Text after the name.'],
  labelBackground: [COLOR, `Fills the ground label; alpha defaults to ${String(DEFAULT_LABEL_BACKGROUND_ALPHA)}.`],
  labelBorder: [`\`{ "color": ${COLOR.replace(/`/g, '')}, "width": 2 }\``, 'Outlines the ground label; width 1 to 3 reads well.'],
  chatMessage: ['text', 'A chat line when the item drops (replaces the notify line).'],
  chatMessageWhenHidden: ['text', 'A chat line when this rule hides the item.'],
  notify: ['true', 'Prints the filter\'s drop line (notifications.dropFormat, default "{qualityColor}{name}").'],
  sound: [
    'a bundled sound file (assets.md), e.g. `"tink.mp3"`; or a sounds.txt name or row (only one the user names: not in the reference)',
    'Plays when the item drops. Sounds of several matching rules add up.',
  ],
  soundVolume: ['0 to 100', "This rule's sound volume."],
  icon: [
    '`{ "iconName": "rune", "iconSize": 40, "color": [r, g, b] }`',
    'A minimap icon (HD only). iconName: a bundled icon (assets.md); iconSize 4 to 256 minimap pixels; color optional.',
  ],
  droplight: ['`{ "color": [r, g, b] }` or `{}` (white)', 'A light beam on the item while it lies on the ground (HD only).'],
  useStyle: ['a style name', "Pulls in that style's actions; the rule's own actions win over the style's."],
  comment: ['text', 'Ignored by the game. Say what the rule does in plain words: the app shows it as the rule title.'],
};

function keysSection(): string {
  return [
    '## Top-level keys',
    '',
    markdownTable(
      ['Key', 'What it is'],
      TOP_LEVEL_KEYS.map((key) => [code(key), TOP_LEVEL[key]])
    ),
  ].join('\n');
}

function conditionsSection(): string {
  return [
    '## Conditions',
    '',
    `Numbers take one value (\`5\`), a list of alternatives (\`[1, 2]\`) or an inclusive range (\`{ "min": 3, "max": 5 }\`, either end optional); named values take the name or its number in the same three shapes.`,
    '',
    markdownTable(
      ['Key', 'Value', 'Holds when'],
      CONDITION_KEYS.map((key) => [code(key), CONDITIONS[key][0], CONDITIONS[key][1]])
    ),
  ].join('\n');
}

const LAYER_TEXT: Readonly<Record<StatLayerKind, string>> = {
  tab: 'the skill tab, class × 8 + tab (skill-tabs.csv; Amazon Bow and Crossbow Skills = 0, Sorceress Fire Skills = 8, Assassin Martial Arts = 50). Not the properties.txt numbering (class × 3 + tab)',
  class: 'the class id 0 to 7 (classes.csv)',
  skill: 'the skill id (skills.csv)',
  event: 'skill id × 64 + skill level (skill 54 level 10 = 3466)',
  charged:
    'skill id × 64 + skill level; its value is max charges × 256 + charges left (5/5 charges = 1285): check `>= 1` for "has charges"',
};

function layeredStats(): string[] {
  const byKind = new Map<StatLayerKind, string[]>();
  for (const [name, kind] of Object.entries(STAT_LAYER_KINDS)) byKind.set(kind, [...(byKind.get(kind) ?? []), name]);
  return [...byKind].map(([kind, names]) => `- ${list(names)}: param = ${LAYER_TEXT[kind]}.`);
}

function statChecksSection(): string {
  return [
    '## Stat checks',
    '',
    'A stat check is `{ "stat": "item_fastercastrate", "param": 0, "op": ">=", "value": 10 }`.',
    '',
    '- `stat`: an itemstatcost name (stats.csv `name`) or its id as a number (never a quoted number).',
    `- \`op\`: ${list(STAT_OPS)}; \`>=\` when left out. \`between\` takes \`"value": [low, high]\`, every other op one number.`,
    '- `param`: only for stats with one entry per skill, skill tab or class (stats.csv `param` column). Without it the plugin reads the entry with param 0, not "any".',
    '- An item without the stat reads 0 (verified in game), so `"op": "<", "value": 1` means "does not have it".',
    '- `itemStats` needs every check (AND), `itemStatsAnyOf` any one (OR). For "A or B, and C" put C in `itemStats` and A, B in `itemStatsAnyOf`: both lists must hold.',
    '- `playerStats` / `playerStatsAnyOf` check the character (e.g. `{ "stat": "level", "op": "<", "value": 30 }`).',
    '',
    'Stats whose param names a skill, skill tab or class:',
    '',
    ...layeredStats(),
  ].join('\n');
}

function actionsSection(): string {
  return [
    '## Actions',
    '',
    markdownTable(
      ['Key', 'Value', 'Effect'],
      ACTION_KEYS.map((key) => [code(key), ACTIONS[key][0], ACTIONS[key][1]])
    ),
  ].join('\n');
}

function combineSection(): string {
  return [
    '## How rules combine',
    '',
    '- Every rule whose conditions all hold applies, top to bottom, until one hides the item.',
    '- All conditions of a rule must hold (AND); values inside one list are alternatives (OR): `"itemCodes": ["r30", "r31"]` matches either.',
    '- `itemCodes` and `itemTypes` both apply: a code that is not of a listed type never matches.',
    "- Later wins: a later rule's name change, background, border, icon or droplight replaces an earlier one's. Chat lines and sounds add up.",
    '- `hide` stops: nothing after the hiding rule runs, and the highlights of the rules above it are gone too. There is no "show" action, so an earlier rule cannot protect an item from a later hide.',
    "- So the order cannot protect an item from a hide rule; only the hide rule's own exceptions can. Order matters for the looks: put broad looks first and the specific ones after them (later wins).",
    '- A rule with an error is switched off by the game (logged with its number); the rest of the filter works.',
    '- Rules look at ground items unless `location` says otherwise. Labels, icons and droplights show on ground items only.',
    "- Styles: `useStyle` pulls in a style's actions; the rule's own actions win key by key. Styles cannot hold conditions or use another style.",
    '- Levels: the player steps through `filterLevels` with a key in game. `activeInLevels` limits a rule to some levels: a hide rule at `[2, 3]` hides only at the stricter levels. Typical levels: 1 Leveling (shows most), 2 Strict, 3 Very strict, each hiding more.',
  ].join('\n');
}

function hideSection(examples: readonly ExampleRule[]): string {
  const exceptExample = examples.find((example) => example.rule.hide === true && example.rule.itemStats !== undefined);
  return [
    '## Hide rules and exceptions',
    '',
    '- A hidden item loses its ground label for good, so keep hide rules narrow: one item type or group and quality per rule, and the exceptions inside the rule.',
    '- Exceptions are negated conditions in the same rule: except lists (`excludeItemCodes`, `excludeItemTypes`, `excludeUniqueOrSetIds`, `excludeAreas`), a quality list without the kept qualities, `sockets: 0`, and stat checks written as `< 1` ("hide the ones without this stat").',
    '- "Hide magic weapons except those with +skills or FCR": `itemStats` with `item_allskills < 1` and `item_fastercastrate < 1` (every check must hold to hide, so either stat keeps the label). Use `itemStatsAnyOf` with `< 1` checks to keep only items with all the stats.',
    '- `hideIfOtherConditionsFail` is the other way round: the codes or types match but another condition does not, so the item is hidden. Every other condition counts, `quality` included: type `weap`, quality magic, a stat check and this flag also hides unique and rare weapons. Use it for "show this base only with sockets"; prefer `hide` with exceptions otherwise.',
    ...(exceptExample === undefined ? [] : ['', 'Example:', '', '```json', ruleJson(exceptExample.rule), '```']),
  ].join('\n');
}

function idsSection(): string {
  return [
    '## Item codes, types, uniques and sets',
    '',
    '- ESR codes differ from the classic game: the classic runes are `r51` (El) to `r83` (Zod), and ESR adds runes of its own (`r01` and up, `r84` and up). Check every code in the tables; never guess one.',
    "- A rule on a parent type matches its children: `weap` all weapons, `armo` all armour, `swor` swords. item-types.csv lists each type's parents.",
    '- Uniques and sets are matched by row id with `uniqueOrSetIds`. ESR has two rows for many uniques: the one that drops and one cubed from an Ancient Coupon; list both ids. Add `"quality": "unique"` (or `"set"`) so a set item with the same number does not match.',
    '- `sockets` is what the item has now; `maxSockets` is what its base can get (for bases the player sockets with the cube or Larzuk).',
    '- Normal (white) and superior items take runewords: `"quality": ["normal", "superior"]` for runeword bases.',
  ].join('\n');
}

const CONTEXT_TEXT: Readonly<Record<PlaceholderContext, string>> = {
  names: 'names',
  chat: 'chat lines',
  dropFormat: 'dropFormat',
  levelChangeFormat: 'levelChangeFormat',
};

function textsSection(): string {
  const shown = COLOR_CODES.filter((entry) => !entry.approximate || entry.usedFor !== '');
  return [
    '## Texts, placeholders and colours',
    '',
    `- Any text is one string or one string per language, \`{ "enUS": "Rune", "deDE": "Rune" }\`; a missing language falls back to enUS. Languages: ${list(LANGUAGES)}. Write enUS always; add other languages only when the user asks.`,
    "- `{string:KEY}` shows a game string in the player's language, e.g. `{string:r01}`.",
    '- Colours: `ÿc` plus one character; the text after it keeps that colour until the next code. In JSON `\\u00ffc` works too. D2RLAN tags like `{red}` are not supported.',
    '',
    markdownTable(
      ['Placeholder', 'Works in', 'Shows'],
      PLACEHOLDERS.map((placeholder) => [
        code(placeholder.token),
        placeholder.contexts.map((context) => CONTEXT_TEXT[context]).join(', '),
        placeholder.description,
      ])
    ),
    '',
    markdownTable(
      ['Code', 'Colour', 'The game uses it for'],
      shown.map((entry) => [code(`ÿc${entry.code}`), entry.name, entry.usedFor])
    ),
  ].join('\n');
}

function limitsSection(): string {
  const scaleNames = (kind: 'shift' | 'perLevel' | 'shiftPerLevel') =>
    list(STAT_SCALES.filter((scale) => scale.kind === kind).map((scale) => scale.name));
  return [
    `## Known plugin limits (plugin ${LOOT_FILTER_PLUGIN_VERSION})`,
    '',
    ...STAT_QUIRKS.map((quirk) => `- ${code(quirk.name)} (${String(quirk.id)}): ${quirk.headline}. ${quirk.message}`),
    `- ${OMITTED_PARAM_RULE}`,
    `- Stored scaled (not verified whether the plugin compares the stored or the shown value; use presence checks \`>= 1\` / \`< 1\` with them): ×256 ${scaleNames('shift')}; eighths per character level ${scaleNames('perLevel')}; both ${scaleNames('shiftPerLevel')}.`,
    '- There is no "show" action and no formula condition.',
    "- Sounds and icons are files next to the filter. Use only the bundled ones in assets.md: the app's .zip download ships them. Icons and droplights need HD graphics.",
    `- The plugin documents no size limit; the app saves filters up to ${String(FILTER_CONTENT_MAX_BYTES / 1024)} KB.`,
  ].join('\n');
}

function jsonStyleSection(): string {
  return [
    '## Writing the file for the app',
    '',
    '- Strict JSON: double quotes, no trailing commas. `//` comment lines are allowed only before the opening `{`; the app drops comments between rules on its first edit, so put explanations in each rule\'s `"comment"`.',
    '- Give every rule a `"comment"`: a short title the app lists ("Hide magic weapons without +skills (Strict)").',
    '- Keys inside a rule: conditions, then actions, then nothing else. Unknown keys are kept but ignored by the game.',
    '- Reuse styles for repeated looks (a "Valuable" style for top items, "Good" for useful ones, or the style presets in examples.md) instead of copying actions. Every `useStyle` name must be defined under `"styles"`.',
  ].join('\n');
}

// --- Common mistakes: what the app reports, from the validator itself ---

export interface MistakeSample {
  /** What went wrong, in a few words. */
  readonly what: string;
  /** The rules of the sample filter (the first is the one shown). */
  readonly rules: readonly Readonly<Record<string, unknown>>[];
  readonly fix: string;
}

const BORDER = { color: [255, 0, 0], width: 2 };

export const MISTAKE_SAMPLES: readonly MistakeSample[] = [
  {
    what: 'an item code that does not exist',
    rules: [{ itemCodes: ['r99'], labelBorder: BORDER }],
    fix: 'use a code from the tables, or ask the user',
  },
  {
    what: 'a type name instead of a type code',
    rules: [{ itemTypes: ['weapon'], labelBorder: BORDER }],
    fix: 'write the code from item-types.csv (`weap`)',
  },
  {
    what: 'a stat label instead of its name',
    rules: [{ itemStats: [{ stat: 'Faster Cast Rate', value: 10 }], labelBorder: BORDER }],
    fix: 'write the stats.csv name (`item_fastercastrate`) or its id',
  },
  {
    what: 'a quality the format does not have',
    rules: [{ quality: 'legendary', labelBorder: BORDER }],
    fix: `use one of ${list(QUALITIES)}`,
  },
  {
    what: 'Enhanced Damage on weapons',
    rules: [{ itemTypes: ['weap'], itemStats: [{ stat: 'item_maxdamage_percent', op: '>=', value: 200 }], labelBorder: BORDER }],
    fix: 'it reads 0 on weapons: use other stats, or tell the user',
  },
  {
    what: 'a skill tab stat without param',
    rules: [{ itemTypes: ['amul'], itemStats: [{ stat: 'item_addskill_tab', op: '>=', value: 2 }], labelBorder: BORDER }],
    fix: 'one check per tab with its param from skill-tabs.csv, in itemStatsAnyOf',
  },
  {
    what: 'a properties.txt tab number as param',
    rules: [{ itemTypes: ['amul'], itemStats: [{ stat: 'item_addskill_tab', param: 20, op: '>=', value: 2 }], labelBorder: BORDER }],
    fix: 'the param is class × 8 + tab (skill-tabs.csv)',
  },
  {
    what: 'a Life value check',
    rules: [{ itemTypes: ['ring'], itemStats: [{ stat: 'maxhp', op: '>=', value: 40 }], labelBorder: BORDER }],
    fix: 'use a presence check (`>= 1`), or tell the user the number is not verified',
  },
  {
    what: 'a level the filter does not have',
    rules: [{ itemTypes: ['hpot'], activeInLevels: [3], hide: true }],
    fix: 'use the ids of filterLevels',
  },
  {
    what: 'a style that does not exist',
    rules: [{ itemCodes: ['r83'], useStyle: 'Great' }],
    fix: 'define it under "styles" or fix the name',
  },
  {
    what: '"between" with one number',
    rules: [{ itemStats: [{ stat: 'item_fastercastrate', op: 'between', value: 10 }], labelBorder: BORDER }],
    fix: '`"value": [10, 20]`',
  },
  { what: 'an empty list', rules: [{ itemCodes: [], labelBorder: BORDER }], fix: 'remove the key or add values' },
  {
    what: 'unique ids with a quality that excludes them',
    rules: [{ uniqueOrSetIds: [418], quality: 'rare', labelBorder: BORDER }],
    fix: 'quality unique (or set), or no quality',
  },
  {
    what: 'codes that are not of the listed types',
    rules: [{ itemCodes: ['r51'], itemTypes: ['weap'], labelBorder: BORDER }],
    fix: 'drop one of the two lists',
  },
  {
    what: 'hideIfOtherConditionsFail with quality',
    rules: [
      {
        itemTypes: ['weap'],
        quality: 'magic',
        itemStats: [{ stat: 'item_allskills', op: '>=', value: 1 }],
        hideIfOtherConditionsFail: true,
      },
    ],
    fix: 'a hide rule with `< 1` exceptions',
  },
  {
    what: 'a hide rule without conditions',
    rules: [{ hide: true }, { itemCodes: ['r83'], labelBorder: BORDER }],
    fix: 'give every hide rule conditions',
  },
  { what: 'a colour out of range', rules: [{ itemCodes: ['r83'], labelBackground: [300, 0, 0] }], fix: 'whole numbers 0 to 255' },
  { what: 'a key the format does not have', rules: [{ itemCodes: ['r83'], show: true }], fix: 'there is no show action; remove it' },
];

/** What the app reports for one sample: the parser's and the validator's messages on its first rule. */
export function mistakeMessages(sample: Pick<MistakeSample, 'rules'>, reference: LootFilterReference): string[] {
  const raw = {
    formatVersion: FORMAT_VERSION,
    filterLevels: [
      { id: 1, name: 'Leveling' },
      { id: 2, name: 'Strict' },
    ],
    defaultLevel: 1,
    rules: sample.rules,
  };
  const { filter, diagnostics } = readLootFilter(raw);
  const all = [...diagnostics, ...validateLootFilter(filter, reference)].filter((diagnostic) => diagnostic.rule === 0);
  return [...new Set(all.map((diagnostic) => `${diagnostic.severity}: ${diagnostic.message}`))];
}

function mistakesSection(reference: LootFilterReference): string {
  const lines = MISTAKE_SAMPLES.flatMap((sample) => {
    const messages = mistakeMessages(sample, reference);
    if (messages.length === 0) return [];
    const [first] = sample.rules;
    return [`- ${sample.what}: \`${json(first)}\``, ...messages.map((message) => `  - app: ${message}`), `  - instead: ${sample.fix}`];
  });
  return [
    '## Common mistakes and what the app reports',
    '',
    'The app checks every filter against the ESR game data. These are its own messages for typical mistakes; when the user pastes such a message back, fix that spot.',
    '',
    ...lines,
  ].join('\n');
}

// --- A complete file ---

/** Vex (r76) to Zod (r83). */
const HIGH_RUNES = ['r76', 'r77', 'r78', 'r79', 'r80', 'r81', 'r82', 'r83'];

/** A small complete filter for FORMAT.md; `formatReference.test.ts` checks it validates cleanly. */
export const SKELETON_FILTER: LootFilter = {
  formatVersion: FORMAT_VERSION,
  title: 'My ESR filter',
  author: 'Me',
  version: '1.0.0',
  description: 'Highlights high runes; hides potions at Strict.',
  filterLevels: [
    { id: 1, name: 'Leveling' },
    { id: 2, name: 'Strict' },
  ],
  defaultLevel: 1,
  soundVolume: 50,
  notifications: { dropFormat: 'ÿc4Drop: {qualityColor}{name}' },
  styles: {
    Valuable: {
      sound: 'tink.mp3',
      labelBorder: { color: [255, 0, 0, 255], width: 2 },
      icon: { iconName: 'goldstar', iconSize: 40 },
      droplight: { color: [255, 128, 0] },
    },
  },
  rules: [
    {
      comment: 'High runes (Vex to Zod): Valuable style and a chat line',
      itemCodes: HIGH_RUNES,
      useStyle: 'Valuable',
      chatMessage: 'ÿc8High rune: {name}',
    },
    { comment: 'Hide health and mana potions (Strict only)', itemTypes: ['hpot', 'mpot'], activeInLevels: [2], hide: true },
  ],
  leadingComments: ['// My ESR filter, written with an AI assistant and checked in the D2R ESR Runeword Browser.'],
};

function plainRule(rule: LootFilterRule): unknown {
  const plain = toPlainJson({ formatVersion: FORMAT_VERSION, rules: [rule], leadingComments: [] });
  return Array.isArray(plain.rules) ? plain.rules[0] : rule;
}

/** A rule as JSON with one key per line and each value on one line (short enough to read, valid to copy). */
export function ruleJson(rule: LootFilterRule): string {
  const plain = plainRule(rule);
  if (typeof plain !== 'object' || plain === null) return JSON.stringify(plain);
  const lines = Object.entries(plain).map(([key, value]) => `  ${JSON.stringify(key)}: ${JSON.stringify(value)}`);
  return `{\n${lines.join(',\n')}\n}`;
}

export interface FormatReferenceInput {
  readonly reference: LootFilterReference;
  readonly examples: readonly ExampleRule[];
  /** The ESR version of the game data, when known. */
  readonly esrVersion?: string;
}

/** FORMAT.md: the filter format, how rules combine, the plugin's limits and the validator's messages. */
export function buildFormatReference({ reference, examples, esrVersion }: FormatReferenceInput): string {
  const data = esrVersion === undefined ? '' : ` Game data: ESR ${esrVersion}.`;
  return [
    '# ESR loot filter format',
    '',
    `The JSON file format of ESR's loot filter plugin (${LOOT_FILTER_PLUGIN_VERSION}), as the D2R ESR Runeword Browser reads and checks it.${data} A filter is one JSON object: a few settings, optional styles, then the rules.`,
    '',
    '## A complete file',
    '',
    '```json',
    serializeLootFilter(SKELETON_FILTER).trimEnd(),
    '```',
    '',
    keysSection(),
    '',
    combineSection(),
    '',
    conditionsSection(),
    '',
    statChecksSection(),
    '',
    actionsSection(),
    '',
    hideSection(examples),
    '',
    idsSection(),
    '',
    textsSection(),
    '',
    limitsSection(),
    '',
    jsonStyleSection(),
    '',
    mistakesSection(reference),
    '',
  ].join('\n');
}

/**
 * The examples as the complete rules the picker adds with their default presentation (title as comment, style, sound,
 * icon, chat), built as one set against the shown presets: a rule that wants no icon while its preset has one uses the
 * `<Name>NoIcon` copy (`buildExampleSet`), so every rule reads right with the preset blocks copied as they are.
 */
export function examplesWithPresentation(
  examples: readonly ExampleRule[],
  presets: readonly PromptStylePreset[] = []
): ReturnType<typeof buildExampleSet> {
  const shown = Object.fromEntries(presets.map((preset) => [preset.name, preset.style]));
  return buildExampleSet(
    examples.map((example) => ({ example, choices: defaultChoices(example) })),
    shown
  );
}

/** A style as `{ "Name": { … } }` with one key per line (valid to copy into "styles"). */
export function styleJson(name: string, style: LootFilterStyle): string {
  const plain: unknown = toPlainJson({ formatVersion: FORMAT_VERSION, styles: { [name]: style }, rules: [], leadingComments: [] }).styles;
  const body = typeof plain === 'object' && plain !== null ? (plain as Record<string, unknown>)[name] : undefined;
  if (typeof body !== 'object' || body === null) return JSON.stringify(plain, null, 2);
  const lines = Object.entries(body).map(([key, value]) => `    ${JSON.stringify(key)}: ${JSON.stringify(value)}`);
  return `{\n  ${JSON.stringify(name)}: {\n${lines.join(',\n')}\n  }\n}`;
}

/**
 * examples.md: the style presets (every style an example uses is among them), then the editor's example rules by group,
 * each as the complete rule the example rules picker adds with its default presentation.
 */
export function buildExamples(examples: readonly ExampleRule[], presets: readonly PromptStylePreset[] = []): string {
  const set = examplesWithPresentation(examples, presets);
  const built = examples.map((example, index) => ({ example, rule: set.rules[index] ?? {} }));
  // A style an example uses but the given presets lack is shown too (a NoIcon copy, say), so every `useStyle` below is defined above.
  const shown = [...presets];
  for (const [name, style] of Object.entries(set.styles)) if (!shown.some((preset) => preset.name === name)) shown.push({ name, style });

  const styles =
    shown.length === 0
      ? []
      : [
          '# Style presets',
          '',
          'Ready-made looks (name colour, label background and border, sometimes a droplight, and most with a minimap icon); the example rules below use them. A rule\'s `"useStyle": "HighRune"` works only when the filter defines that style under `"styles"`: for every preset you use, copy its block into the filter\'s `"styles"` object under the same name (change the look freely). A missing one is the app\'s "There is no style named …" error. A rule\'s own `"icon"` replaces its style\'s, but no rule can remove it: a rule that wants no icon uses a copy of the style without one (the `NoIcon` blocks). Sounds and chat lines stay on the rules.',
          '',
          ...shown.flatMap((preset) => [
            `## ${preset.name}`,
            '',
            ...(preset.description === undefined ? [] : [preset.description, '']),
            '```json',
            styleJson(preset.name, preset.style),
            '```',
            '',
          ]),
        ];

  const groups = EXAMPLE_GROUPS.flatMap((group) => {
    const entries = built.filter(({ example }) => example.group === group.id);
    if (entries.length === 0) return [];
    return [
      `## ${group.title}`,
      '',
      group.intro,
      '',
      ...entries.flatMap(({ example, rule }) => [
        `### ${example.title}`,
        '',
        example.description,
        '',
        '```json',
        ruleJson(rule),
        '```',
        '',
      ]),
    ];
  });

  return [
    ...styles,
    '# Example rules',
    '',
    "Complete rules in groups: conditions, a style preset from above, and on the valuable drops a bundled sound, a minimap icon and a chat line; hide rules have no looks (a hidden item shows nothing). They use real ESR codes and pass the app's checks: reuse and adapt them. Put the label rules first and the hide rules last; a hide rule hides wherever it stands, so this only keeps the filter readable.",
    '',
    ...groups,
  ].join('\n');
}

/** assets.md: the sound and icon files the app bundles (its .zip download puts them next to the filter). */
export function buildAssets(assets: PromptAssets): string {
  const line = (asset: PromptAsset) => `- ${code(asset.name)}${asset.note === undefined ? '' : `: ${asset.note}`}`;
  return [
    '# Bundled sounds and icons',
    '',
    'Use only these files: the app\'s "Download .zip with sounds and icons" puts them in the `sounds` and `icons` folders next to the filter. Other files work only if the user adds them; ask first.',
    '',
    '## Sounds (`"sound": "tink.mp3"`)',
    '',
    ...assets.sounds.map(line),
    '',
    '## Minimap icons (`"icon": { "iconName": "rune", "iconSize": 40 }`, the name without .sprite)',
    '',
    ...assets.icons.map(line),
    '',
    'Icon sizes of 30 to 50 minimap pixels read well. A sound name of the game\'s sounds.txt also works as "sound" (it follows the game volume; no file needed). The reference does not list them: use one only when the user asks for a game sound, with the exact name the user gives (the app\'s sound picker lists them).',
    '',
  ].join('\n');
}
