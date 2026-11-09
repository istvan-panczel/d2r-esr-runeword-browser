/**
 * What the cube reference (cube.json) shows: the rows it hides, the families after the guide's CUBE_FAMILIES, the
 * fallback grouping and the sections of the official Cube Recipes page each family belongs to.
 */
import { CUBE_FAMILIES, craftClass, genericRuneForging, type CubeFamily, type FamilyTables } from './cubeFamilies.ts';
import type { CubeRow } from './cubeRows.ts';
import { ADJECTIVES, parseCubeCell, type RecipeVariant } from './cubeText.ts';

// --- hidden rows --------------------------------------------------------------------------------------------------

/**
 * Why a row is not listed: `enhance` = corruption, anointment and Vessel of Souls tier rows (with their roll rows and
 * blockers), shown on the Enhance page from enhance.json; `traps` = `void` outputs and "Trap" rows (blockers);
 * `old` = "OLD (Delete later)" rows; `stockers` = stocker and can bookkeeping (storing and taking out materials);
 * `dummy` = the remaining "Add … Dummy Stat" roll rows.
 */
export type HiddenReason = 'enhance' | 'traps' | 'old' | 'stockers' | 'dummy';
export const HIDDEN_REASONS: readonly HiddenReason[] = ['enhance', 'traps', 'old', 'stockers', 'dummy'];

/** The rows enhance.json covers (matched by description; bundleEnhance classifies the same rows by their data) */
export const ENHANCE_ROW =
  /Corruption(?: Brick| Legacy Roll)? - |^Vessel of Souls Transform to Mythical .* - Anointed$|^Add (?:Corruption|Anointment) Dummy Stat|^Anointment - |^Vessel of Souls Tier \d+ - |^Check if already (?:Corrupted|Anointed)|^Prevent Vessel of Souls Corrupt/i;
/** "Trap" blockers ("Kill Ledger Trap", "Trap Too High Req Lvl"), not "Starter Weapon for Trap Assassin" */
const TRAP_ROW = /\bTrap\b(?! Assassin)/i;
const OLD_ROW = /OLD \(Delete later\)/;
const STOCKER_ROW = /Stocker|Gem Can|Xtal Can|Rerolling Orb/;
/**
 * Display or internal names of the stocker and can items (a row with one as input is bookkeeping). Not the Rerolling
 * Orb: it is an input of the custom ring and amulet rerolls.
 */
export const STOCKER_ITEM = /Stocker|Gem Can|Crystal Can|Xtal Can/;
const DUMMY_ROW = /^Add .*Dummy Stat/;

/** A guide family claims the row (first match): its rows are never "stocker" or "dummy" bookkeeping */
export function guideFamilyOf(row: CubeRow): CubeFamily | undefined {
  return CUBE_FAMILIES.find((family) => family.match.test(row.description) && (family.filter?.(row) ?? true));
}

/**
 * Why the row is hidden, null when it is listed. `claimed`: a guide family or a stocker family (STOCKER_FAMILIES)
 * matches it (the Anvil Stone's Multi Stocker row, the Rune Stocker upgrades); `stockerInput`: an input is a stocker
 * or can item (the Crystal Can rows are labelled "Moon Rune" …).
 */
export function hiddenReason(row: CubeRow, claimed: boolean, stockerInput = false): HiddenReason | null {
  if (ENHANCE_ROW.test(row.description)) return 'enhance';
  if (row.outputs.some((output) => output.spec === 'void') || TRAP_ROW.test(row.description)) return 'traps';
  if (OLD_ROW.test(row.description)) return 'old';
  if (claimed) return null;
  if (STOCKER_ROW.test(row.description) || stockerInput) return 'stockers';
  if (DUMMY_ROW.test(row.description)) return 'dummy';
  return null;
}

// --- sections -----------------------------------------------------------------------------------------------------

export const CUBE_DOCS_PAGE = 'Eastern Sun Resurrected Cube Recipes.html';

export interface SectionDef {
  id: string;
  label: string;
  /** Official docs page (file name), null when no page covers it */
  doc: string | null;
  /** Anchor on that page */
  anchor: string | null;
  /** Short notes from the official page's footnotes for this section; omitted: none */
  notes?: readonly string[];
  /** Guide note slugs (content/guide/notes) that explain the section; omitted: none */
  guide?: readonly string[];
  /** App page that covers the section (`CubeSection.page`); omitted: none */
  page?: { path: string; label: string };
}

const cubePage = (id: string, label: string, extra: Pick<SectionDef, 'notes' | 'guide'> = {}): SectionDef => ({
  id,
  label,
  doc: CUBE_DOCS_PAGE,
  anchor: id,
  ...extra,
});

/** In display order: the official Cube Recipes page's sections, then the pages for the endgame systems, then the rest */
export const CUBE_SECTIONS: readonly SectionDef[] = [
  cubePage('uber', 'Uber / Endgame Maps', { guide: ['maps-keys-ascendancy', 'unique-charms'] }),
  cubePage('legendary', 'Legendary Consumables', {
    notes: [
      'Each consumable works once and cannot be undone.',
      "Tyrael's Eternal Feather also works on items that are already ethereal (an engine bug), so it can be wasted; it does not work on missile weapons.",
      'Spell Mastery adds 4% total spell damage per level and stacks with the other masteries.',
      "Astrogha's Petrified Heart clears the corruption status so the item can be corrupted again; on a Triune Harbinger of Apocalypse staff it allows one more corruption.",
      'Branded items cannot be changed by any recipe; a copy keeps the socketed items, which cannot be removed.',
    ],
    guide: ['enhancement-order', 'corruption-anointment'],
  }),
  cubePage('mis', 'Misc', { guide: ['cube-basics', 'starter-pack'] }),
  cubePage('gem', 'Gems / Runes', { guide: ['gems-crystals', 'rune-families', 'stockers'] }),
  cubePage('rel', 'Ancient Relics', {
    notes: ['LoD uniques are reworked in ESR: stronger than in vanilla and, being harder to get, generally stronger than ESR uniques.'],
    guide: ['coupons', 'secret-recipes'],
  }),
  cubePage('mat', 'Cubing Materials', {
    notes: [
      'Organs are Hearts, Souls, Brains, Eyes, Scalps, Horns, Fangs, Jawbones, Spleens, Quills and Tails; Steaks, Cookbooks and Flags are not.',
      'Stockers are sold by Gheed; most store up to 2 items of a kind at once.',
    ],
    guide: ['dragon-stones', 'stockers'],
  }),
  cubePage('nor', 'Normal Items'),
  cubePage('mag', 'Magic / Rare Items', {
    notes: [
      'Most rerolls do nothing on an item with a Forging: remove it first.',
      'The cheaper rare reroll (one Blemished Gem) lowers the item level a little with each use, and the item rolls at most 1 socket.',
    ],
    guide: ['cube-basics'],
  }),
  cubePage('uni', 'Unique Items', {
    notes: [
      'Base-upgraded uniques cannot be rerolled: reroll before upgrading.',
      'Sockets added before a reroll are lost.',
      'Level 92 unique jewels and quivers cannot be rerolled.',
    ],
    guide: ['enhancement-order'],
  }),
  cubePage('set', 'Set Items', {
    notes: [
      "Mercenary set upgrades: the upgraded items are a different set (Kashya's Survival Kit and Kashya's Survival Kit N), so a partly upgraded set loses its full-set bonus.",
      'Set base conversions keep Forging, D-stoning and other enhancements; convert the item back to its original base before rerolling it.',
    ],
  }),
  cubePage('old', 'Legacy Craft', {
    notes: [
      'Any base of the slot works (the Blood Glove recipe takes all gloves). Item level = 60% of character level + 60% of the old item level.',
    ],
    guide: ['class-crafting'],
  }),
  cubePage('new', 'Class Craft', {
    notes: [
      'Class crafted items can be used by any class unless the base is class-specific; each also rolls 1-4 random affixes.',
      'Stat, Rune and Tab Forging work on crafted items. Item level = 60% of character level + 60% of the old item level.',
    ],
    guide: ['class-crafting'],
  }),
  cubePage('rin', 'Rings / Amulets', {
    notes: [
      'When rerolling several rings or amulets, the last one put in the cube decides the type (a Sorceress ring last gives a Sorceress ring).',
      "If the output item level is below the unique's level, it becomes a rare. A non-class unique ring or amulet needs character level above 15, a class one above 57.",
    ],
  }),
  cubePage('cha', 'Charms', { guide: ['noobs-charm', 'unique-charms'] }),
  cubePage('jew', 'Jewels'),
  cubePage('qui', 'Arrow/Bolt Quivers'),
  cubePage('for', 'Forging', {
    notes: [
      'An item holds one Forging at a time; remove it to apply another. Wo Forging (Indestructible) cannot be removed.',
      'Removing an Aura Forging destroys the Aura Stone. Merc Only Conversion stacks with Forgings.',
    ],
    guide: ['forging', 'mercenaries-oskills'],
  }),
  cubePage('dst', 'D-Stoning', {
    notes: [
      'D-stoning also works on runeword items and cannot be removed.',
      'Its caps count only what D-stoning adds (on top of the affixes), except enhanced damage and enhanced defense, which cannot go above 500% on any item.',
      'D-stoning a white item before making the runeword survives removing the runes; D-stoning added after the runeword is lost with them.',
      'Summon damage applies to all damage minions deal. Gem melding works up to 20 times on weapons and 10 times on other gear.',
    ],
    guide: ['dstoning-and-mapling', 'dragon-stones'],
  }),
  cubePage('tin', 'Tinkering', {
    notes: [
      'Every item rolls 25-35 hidden tinkering points; each recipe uses some, and an item that cannot be tinkered any more has none left.',
    ],
    guide: ['tinkering'],
  }),
  cubePage('bas', 'Base Upgrades', {
    notes: [
      'After a base upgrade, uniques and sets cannot be rerolled and convertible sets cannot be converted.',
      'Ethereal armor is not accepted (the upgrade would barely raise its defense).',
    ],
  }),
  cubePage('soc', 'Sockets', {
    notes: [
      'An item never gets more sockets than its base allows, and an existing socket count cannot be changed; Normal and Nightmare Act 1 drops may not reach the maximum.',
      'Unsocketing with a Key also identifies the item. Socketed quivers do not show their quantity (a game bug).',
    ],
    guide: ['socketing'],
  }),
  cubePage('sec', 'Secret Recipes', {
    notes: ['Each needs its identified Ancient Scroll, which is returned after the recipe.'],
    guide: ['secret-recipes'],
  }),
  cubePage('tyrael', "Tyrael's Might Extra Boon", { notes: ["Tyrael's Might takes one extra boon, once."] }),
  { id: 'ascendancy', label: 'Ascendancies', doc: 'ascendancies.htm', anchor: null, guide: ['ascendancies'] },
  {
    id: 'kill-ledger',
    label: 'Kill Ledger',
    doc: 'kill_ledger.htm',
    anchor: null,
    guide: ['kill-ledger'],
    page: { path: '/kill-ledger', label: 'Kill Ledger page' },
  },
  { id: 'weapon-mastery', label: 'Weapon Mastery', doc: 'weapon_mastery.html', anchor: null, guide: ['weapon-mastery'] },
  { id: 'vessel', label: 'Vessel of Souls', doc: 'vessel_of_souls.htm', anchor: null, guide: ['vessel-of-souls'] },
  { id: 'other', label: 'Other recipes', doc: null, anchor: null },
];

/** Section of each guide family (CUBE_FAMILIES) */
export const GUIDE_FAMILY_SECTIONS: Readonly<Partial<Record<string, string>>> = {
  'dstone-cycle': 'mat',
  'anvil-stone': 'for',
  'remove-forging': 'for',
  'skill-forging': 'for',
  'all-skill-forging': 'for',
  'aura-forging': 'for',
  'rune-forging': 'for',
  'stat-forging': 'for',
  socket: 'soc',
  'coupon-tiers': 'rel',
  'gem-upgrade': 'gem',
  'crystal-upgrade': 'gem',
  'legendary-consumables': 'legendary',
  'respec-token': 'mis',
  'starter-pack': 'mis',
  'map-upgrade': 'uber',
  'charm-reroll': 'cha',
  'rune-conversion': 'gem',
  tinkering: 'tin',
  'uber-keys': 'uber',
  'merc-only': 'for',
  'weapon-mastery': 'weapon-mastery',
  unsocket: 'soc',
  'lucion-essence': 'soc',
  'kill-ledger-tiers': 'kill-ledger',
  'kill-ledger-bosses': 'kill-ledger',
  'ancient-scrolls': 'rel',
  'unique-charm-upgrades': 'uber',
  'maple-leaf': 'cha',
  'class-craft': 'new',
  'gem-meld': 'dst',
  ascendancy: 'ascendancy',
  'vessel-transform': 'vessel',
};

// --- families after the guide's ------------------------------------------------------------------------------------

/** The description with its numbers as `#` ("Unique: 12 Sets" → "Unique: # Sets"): one group per recipe shape */
export function descriptionShape(description: string): string {
  return description.replace(/\d+/g, '#').replace(/\s+/g, ' ').trim();
}

const byShape = (row: CubeRow) => descriptionShape(row.description);

/** A named item cubed with reagents into itself (a unique or set reroll): "The same item, rerolled" */
function sameItemReroll(recipe: RecipeVariant, row: CubeRow): RecipeVariant {
  const first = row.inputs.at(0);
  const output = row.outputs.at(0);
  if (first === undefined || output === undefined || row.outputs.length !== 1 || first !== output.spec) return recipe;
  return { inputs: recipe.inputs, output: 'The same item, rerolled' };
}

/** "3× Set Quilted Armor → Quilted Armor (Unique)" as one row for every base */
function baseConversion(recipe: RecipeVariant, row: CubeRow): RecipeVariant {
  const match = /^(Unique|Set): \d+ (Sets|Uniques)$/.exec(row.description);
  const first = parseCubeCell(row.inputs[0] ?? '');
  if (match === null || row.inputs.length !== 1) return sameItemReroll(recipe, row);
  const from = match[2] === 'Sets' ? 'Set' : 'Unique';
  return { inputs: [`${String(first.qty)}× ${from} items of one base`], output: `A ${match[1].toLowerCase()} item of that base` };
}

export interface ExtraFamily extends CubeFamily {
  section: string;
}

// --- stockers, cans and the Rerolling Orb: the player-facing rows ---------------------------------------------------

/** A stocker counter an output changes: what it counts ("Magic Ring Point", "Ancient Decipherer") and by how much */
interface Counter {
  name: string;
  amount: number;
}

function counters(row: CubeRow, esr: FamilyTables): Counter[] {
  return row.outputs.flatMap((output) =>
    output.mods.flatMap((mod) => {
      const name = esr.counterName?.(mod.mod) ?? null;
      return name === null ? [] : [{ name, amount: mod.max }];
    })
  );
}

/** "3 Magic Ring Points", "1 Ancient Decipherer point", "50 Frozen Soul points" */
export function pointsText(amount: number, name: string): string {
  const count = Math.abs(amount);
  return / Point$/.test(name)
    ? `${String(count)} ${name}${count === 1 ? '' : 's'}`
    : `${String(count)} ${name} point${count === 1 ? '' : 's'}`;
}

/** The text without its leading "The same item + " (the stocker itself, whose counters changed) */
function withoutSameItem(output: string): string {
  return output.replace(/^The same item(?: \+ |$)/, '');
}

/** A stocker input row that is not plain storage: a set, crafted or unique item, a named item, or other points than items */
function isStockerConversion(row: CubeRow): boolean {
  const cell = parseCubeCell(row.inputs[1] ?? '');
  const amounts = row.outputs.flatMap((output) => output.mods.map((mod) => mod.max));
  return (
    cell.qualifiers.some((part) => part === 'set' || part === 'crf' || part === 'uni') ||
    !/^[a-z0-9]{3,4}$/.test(cell.token) ||
    amounts.some((amount) => amount !== cell.qty)
  );
}

const stockerModes = new WeakMap<FamilyTables, Map<string, string>>();

/**
 * The item a stocker item code is set to (Multi Stocker `t56` → "Brain", Rerolling Orb `t01` → "Magic Ring Point"):
 * the counter its "… Output" row (taking one out) lowers.
 */
function stockerMode(token: string, esr: FamilyTables): string | null {
  let modes = stockerModes.get(esr);
  if (modes === undefined) {
    modes = new Map();
    for (const row of esr.cube) {
      const first = parseCubeCell(row.inputs[0] ?? '').token;
      if (!/(?:Stocker|Rerolling Orb) Output$/.test(row.description) || modes.has(first)) continue;
      const spent = counters(row, esr).find((counter) => counter.amount < 0);
      if (spent !== undefined) modes.set(first, spent.name);
    }
    stockerModes.set(esr, modes);
  }
  return modes.get(token) ?? null;
}

/**
 * Point transfers inside a stocker (Rune Stocker upgrades, Multi Stocker conversions): the stocker set to an item
 * ("Brain (selected)") and what its counters do ("2 points of the selected item → 1 Ancient Decipherer point"). A
 * counter of the selected item is not named, so the rows of one rate merge into one row listing the items.
 */
function stockerTransfer(recipe: RecipeVariant, row: CubeRow, esr: FamilyTables): RecipeVariant {
  const changes = counters(row, esr);
  const stocker = parseCubeCell(row.inputs[0] ?? '').token;
  const name = esr.nameOf(stocker);
  const mode = stockerMode(stocker, esr);
  const points = (counter: Counter) =>
    counter.name === mode ? `${String(Math.abs(counter.amount))} of the selected item` : pointsText(counter.amount, counter.name);
  const spent = changes.filter((counter) => counter.amount < 0).map(points);
  const gained = changes.filter((counter) => counter.amount > 0).map(points);
  // Storing an item for other points: "+50 Ancient Decipherer points"
  if (spent.length === 0) {
    const added = changes.map((counter) => `+${pointsText(counter.amount, counter.name)}`);
    const inputs = recipe.inputs.map((input, i) => (i === 0 ? name : input));
    const rest = withoutSameItem(recipe.output);
    return { inputs, output: `The same ${name} (${added.join(', ')})${rest === '' ? '' : ` + ${rest}`}` };
  }
  const inputs = [name, ...(mode === null ? [] : [`${mode} (selected)`]), ...recipe.inputs.slice(1)];
  const rest = withoutSameItem(recipe.output);
  const transfer = gained.length === 0 ? `uses ${spent.join(' + ')}` : `${spent.join(' + ')} → ${gained.join(' + ')}`;
  return { inputs, output: `The same ${name} (${transfer})${rest === '' ? '' : ` + ${rest}`}` };
}

/**
 * Rune and Decal Stocker upgrades: the stocker set to a rune, its points into points of the next one; one row per
 * stocker (the rune it is set to does not change the recipe).
 */
function stockerUpgrade(recipe: RecipeVariant, row: CubeRow, esr: FamilyTables): RecipeVariant {
  const changes = counters(row, esr);
  const spent = changes.find((counter) => counter.amount < 0);
  const gained = changes.find((counter) => counter.amount > 0);
  const name = esr.nameOf(parseCubeCell(row.inputs[0] ?? '').token);
  const kind = /Decal/.test(row.description) ? 'decal' : 'rune';
  if (spent === undefined || gained === undefined) return recipe;
  return {
    inputs: [`${name} (set to the ${kind} to upgrade)`, ...recipe.inputs.slice(1)],
    output: `The same ${name} (${String(Math.abs(spent.amount))} points of that ${kind} → ${String(gained.amount)} point of the next ${kind})`,
  };
}

/** "Magic Ring Point" → "ring"; "SC Point" → "small charm" */
const POINT_KINDS: Readonly<Partial<Record<string, string>>> = {
  Ring: 'ring',
  Amulet: 'amulet',
  Jewel: 'jewel',
  SC: 'small charm',
  LC: 'large charm',
  GC: 'grand charm',
  Arrow: 'arrow quiver',
  Bolt: 'bolt quiver',
};

/**
 * Rerolling Orb outputs: the orb set to a kind of point (Magic Ring Points) makes a new item of that kind for its
 * points; the Key is kept, and for rings and amulets a Dragon Stone form instead of the Key gives a class one.
 */
function rerollingOrbOutput(recipe: RecipeVariant, row: CubeRow, esr: FamilyTables): RecipeVariant {
  const orb = parseCubeCell(row.inputs[0] ?? '').token;
  const spent = counters(row, esr).find((counter) => counter.amount < 0);
  const mode = stockerMode(orb, esr);
  if (spent === undefined || mode === null) return recipe;
  const kind = POINT_KINDS[/^(?:Magic |Rare )?(\w+) Point$/.exec(mode)?.[1] ?? ''];
  const created = row.outputs.find((output) => output.spec !== 'useitem' && !row.inputs.includes(output.spec));
  const quality = parseCubeCell(created?.spec ?? '')
    .qualifiers.flatMap((part) => ADJECTIVES[part] ?? [])
    .at(0);
  const siblings = esr.cube.filter((other) => other.description === row.description && other.inputs[0] === row.inputs[0]).length;
  const cost = `for ${pointsText(spent.amount, spent.name)}`;
  if (kind === undefined || quality === undefined) {
    return {
      inputs: [`${esr.nameOf(orb)} (set to ${mode}s)`, ...recipe.inputs.slice(1)],
      output: `${withoutSameItem(recipe.output)} (${cost})`,
    };
  }
  // The orb's setting picks both the points it spends and the quality it makes (Magic Ring Points → a rare ring)
  const made = `${quality.toLowerCase()} ${kind}`;
  const orbText = `${esr.nameOf(orb)} (set to ${mode}s → ${made})`;
  if (siblings === 1) return { inputs: [orbText, ...recipe.inputs.slice(1)], output: `A new ${made} (${cost})` };
  return { inputs: [orbText, `Key, or a Dragon Stone form for a class ${kind}`], output: `A new ${made}, or a class ${kind} (${cost})` };
}

/** Rerolling Orb inputs that give other points than the item's own (Devil's Food, Jewel Points from set rings) */
function rerollingOrbInput(recipe: RecipeVariant, row: CubeRow, esr: FamilyTables): RecipeVariant {
  return /Output$/.test(row.description) ? rerollingOrbOutput(recipe, row, esr) : stockerTransfer(recipe, row, esr);
}

/** Gem Can rerolls: any colour's can, paying with the points of its gem ("243 points of the can's gem") */
function gemCanReroll(recipe: RecipeVariant, row: CubeRow, esr: FamilyTables): RecipeVariant {
  const spent = counters(row, esr).find((counter) => counter.amount < 0);
  const can = esr.nameOf(parseCubeCell(row.inputs[0] ?? '').token);
  if (spent === undefined) return recipe;
  const amount = Math.abs(spent.amount);
  return {
    inputs: [`${can} (any gem, ${String(amount)}+ points)`, ...recipe.inputs.slice(1)],
    output: `${withoutSameItem(recipe.output)} (uses ${String(amount)} point${amount === 1 ? '' : 's'} of the can's gem)`,
  };
}

/** Kanji runes into a Crystal Can: their crystal points, the Null Rune back */
function crystalCanKanji(recipe: RecipeVariant, row: CubeRow, esr: FamilyTables): RecipeVariant {
  const added = counters(row, esr).filter((counter) => counter.amount > 0);
  const can = esr.nameOf(parseCubeCell(row.inputs[0] ?? '').token);
  const rest = withoutSameItem(recipe.output);
  return {
    inputs: [can, ...recipe.inputs.slice(1)],
    output: `The same ${can} (${added.map((counter) => `+${pointsText(counter.amount, counter.name)}`).join(', ')})${rest === '' ? '' : ` + ${rest}`}`,
  };
}

const CAN_INPUT = (row: CubeRow) => /^can\d+$/.test(parseCubeCell(row.inputs[0] ?? '').token);

const STOCKER_GROUP_LABELS: Readonly<Partial<Record<string, string>>> = {
  'Multi Stocker Input': 'Points from items (Ancient Decipherers, Rejuvenation potions)',
  'Multi Stocker Decipherer': 'Points into Ancient Decipherer points (Scroll of Identify)',
  'Multi Stocker Normal Coupon -> Exceptional Coupon': 'Coupon and Wild Card points',
  'Multi Stocker Hrt -> Selected Organ/Ear': 'Heart and Soul points into the selected organ',
  'Maple Leaf in Stocker: Unique Charm + Key + any rejuv pot': 'Maple Leaf points',
};

/**
 * The stocker rows a player uses on purpose: upgrades, conversions and rerolls. Storing an item and taking it out,
 * and cycling the selected item, stay hidden (`stockers`). Listed in EXTRA_FAMILIES; assignCubeRows lets them claim
 * their rows before the stocker rule hides them.
 */
export const STOCKER_FAMILIES: readonly ExtraFamily[] = [
  {
    id: 'stocker-upgrades',
    label: 'Rune and Decal Stocker upgrades',
    section: 'gem',
    match: /^(?:Rune|Decal) Stocker Upgrade$/,
    rewrite: stockerUpgrade,
    collapse: true,
    groupLabel: (rows) => (rows[0]?.description ?? '').replace(/ Upgrade$/, ''),
  },
  {
    id: 'crystal-can',
    label: 'Crystal Can: Kanji runes into crystal points',
    section: 'gem',
    match: /^\w+ Rune$/,
    filter: CAN_INPUT,
    rewrite: crystalCanKanji,
  },
  {
    id: 'multi-stocker',
    label: 'Multi Stocker conversions (Decipherers, organs, coupons, Maple Leaves)',
    section: 'mat',
    match:
      /^"?(?:Multi Stocker (?:Decipherer|Normal Coupon -> Exceptional Coupon|Exceptional Coupon -> Elite Coupon|Wildcard|(?:Hrt|Sol) -> Selected Organ\/Ear|Input|\+ Unique Charm \+ Key .*|\+ Wirt's Leg .*)|Maple Leaf in Stocker: .*)"?$/,
    filter: (row) => row.description !== 'Multi Stocker Input' || isStockerConversion(row),
    rewrite: stockerTransfer,
    collapse: (row) =>
      row.description === 'Multi Stocker Input'
        ? 'Decipherer points'
        : /Coupon|Wildcard/.test(row.description)
          ? 'coupons'
          : /Selected Organ/.test(row.description)
            ? 'organs'
            : /Maple Leaf/.test(row.description)
              ? 'maple'
              : row.description,
    groupLabel: (rows) => {
      const description = rows[0]?.description ?? '';
      if (/Maple Leaf/.test(description)) return 'Maple Leaf points';
      if (/Wirt's Leg/.test(description)) return "Cookbook from Ancient Decipherer points (Wirt's Leg)";
      return STOCKER_GROUP_LABELS[description] ?? descriptionShape(description);
    },
  },
  {
    id: 'rerolling-orb',
    label: "Rerolling Orb rerolls and Devil's Food points",
    section: 'rin',
    match: /^Rerolling Orb (?:Input|Output)$/,
    filter: (row) => row.description === 'Rerolling Orb Output' || isStockerConversion(row),
    rewrite: rerollingOrbInput,
    collapse: (row) => (row.description === 'Rerolling Orb Output' ? 'rerolls' : 'points'),
    groupLabel: (rows) =>
      rows[0]?.description === 'Rerolling Orb Output' ? 'Rerolls for points' : "Points from set, crafted and unique items (Devil's Food)",
  },
  {
    id: 'gem-can-rerolls',
    label: 'Gem Can rerolls (charms, jewels, quivers)',
    section: 'cha',
    match: /^Gem Can (?:Randomizing Stone|.*Reroll.*)$/,
    rewrite: gemCanReroll,
    collapse: true,
    groupLabel: (rows) => descriptionShape(rows[0]?.description ?? '').replace(/:.*$/, ''),
  },
];

const CRUCIBLE_PREFIX = /^(?:\[SECRET\d+\] )?Crucible - /;

/**
 * ESR 3.3 "Crucible - <forging>" rows (Blacksmith perk The Secret Crucible): a second forging, the same recipe as the
 * forging family that matches the rest of the description; that family's rewrite words it.
 */
/** The forging families' titles per forging kind of a "Crucible - [Remove ]<…> <kind> Forging <slot>" description */
const CRUCIBLE_KINDS: readonly (readonly [RegExp, string])[] = [
  [/\bAll Skill Forging\b/, 'all skills forging'],
  [/\bSkill Forging\b/, 'class skill forging'],
  [/\bStat Forging\b/, 'stat forging'],
  [/\bRune Forging\b/, 'rune forging'],
  [/\bAura Forging\b/, 'aura forging'],
  [/\bForging Exp\b/, 'experience forging (secret recipe)'],
];

/**
 * Cube page title of a crucible group, from its first row's description: the forging kind (the group mixes every
 * quality, class and slot the cubemain rows name, so none of those is in the title) and whether it adds or removes it.
 */
export function crucibleGroupLabel(description: string): string {
  const rest = description.replace(CRUCIBLE_PREFIX, '');
  const kind = CRUCIBLE_KINDS.find(([pattern]) => pattern.test(rest))?.[1];
  if (kind === undefined) return descriptionShape(description);
  return /^Remove\b/.test(rest) ? `Removing the second ${kind}` : `Second ${kind}`;
}

function crucibleForging(recipe: RecipeVariant, row: CubeRow, esr: FamilyTables): RecipeVariant {
  const description = row.description.replace(CRUCIBLE_PREFIX, '');
  const base = CUBE_FAMILIES.find((family) => family.match.test(description));
  return base?.rewrite === undefined ? recipe : base.rewrite(recipe, { ...row, description }, esr);
}

/** Families of the cube reference after CUBE_FAMILIES (first match wins), grouped by description shape unless set */
export const EXTRA_FAMILIES: readonly ExtraFamily[] = [
  ...STOCKER_FAMILIES,
  {
    id: 'crucible',
    label: 'Crucible forging (a second forging)',
    section: 'for',
    match: CRUCIBLE_PREFIX,
    rewrite: crucibleForging,
    // Each rune and gem has its own bonus (hundreds of rows): the forging families list them
    outputBonus: 'hide',
    collapse: (row) =>
      /\[SECRET\d+\]/.test(row.description)
        ? 'secret'
        : (/(?:Remove )?(?:All Skill|Skill|Stat|Rune|Aura) Forging/.exec(row.description)?.[0] ?? row.description),
    groupLabel: (rows) => crucibleGroupLabel(rows[0]?.description ?? ''),
  },
  {
    id: 'unique-reroll',
    label: 'Unique rerolls',
    section: 'uni',
    match: /^(?:Eth )?Unique (?:Reroll|Weapon Reroll|Armor Reroll)\b/,
    rewrite: sameItemReroll,
    collapse: byShape,
  },
  {
    id: 'set-conversion',
    label: 'Set and unique conversions, set cycles and rerolls',
    section: 'set',
    match: /^(?:Unique: \d+ Sets|Set: \d+ Uniques|Set Conv |Set Cycle$|Set Reroll(?: \w+)?$)/,
    rewrite: baseConversion,
    collapse: byShape,
  },
  {
    id: 'rune-forging-slots',
    label: 'Rune forging on wands, staves, orbs, gloves, body armor, shields and belts',
    section: 'for',
    match: /^Rune Forging (?:wand|staf|orb|glov|tors|shld|belt)$/,
    rewrite: genericRuneForging,
    outputBonus: 'hide',
    collapse: true,
  },
  {
    // Not in rune-forging-slots: crafting.json has no slot for the one item code `m11`
    id: 'rune-forging-mythical-staff',
    label: 'Rune forging on the Mythical Arcane Staff',
    section: 'for',
    match: /^Rune Forging Mythical Arcane Staff$/,
    rewrite: genericRuneForging,
    outputBonus: 'hide',
    collapse: true,
  },
  {
    id: 'legacy-craft',
    label: 'Legacy crafts (Hit Power, Blood, Caster, Safety)',
    section: 'old',
    match: /^magic [\w' ]+ \+ jewel \+ rune \d+ \+ perfect \w+ -> \w+ \w+$/,
    collapse: (row) => /-> (\w+) \w+$/.exec(row.description)?.[1] ?? row.description,
    // The descriptions name the wrong gem for some crafts ("perfect amethyst -> caster helm" takes a Perfect Sapphire)
    groupLabel: (rows) => {
      const craft = /-> (\w+) \w+$/.exec(rows[0]?.description ?? '')?.[1] ?? '';
      return `${LEGACY_CRAFTS[craft] ?? craft} craft`;
    },
  },
  {
    id: 'base-upgrade',
    label: 'Base upgrades and changes',
    section: 'bas',
    match: /^(?:(?:Excep|Elite) Upgrade: |Helm -> |Unique Stone \(|Belt Upgrade: )/,
    collapse: byShape,
  },
  {
    id: 'normal-items',
    label: 'Normal items, arrows and bolts',
    section: 'nor',
    match: /^(?:Normal (?:Weapon|Armor): Low |\d+ Socket \w+ ?: |Normal (?:Arrows|Bolts): )/,
    collapse: byShape,
  },
  {
    id: 'magic-rare-reroll',
    label: 'Magic and rare rerolls, starter weapons',
    section: 'mag',
    match: /^(?:(?:Eth )?(?:Magic|Rare)(?: Std)? (?:Weapon|Armor) Reroll|Magic Armor ctc |Starter Weapon for )/,
    collapse: (row) => (/^Starter Weapon/.test(row.description) ? 'Starter Weapon' : descriptionShape(row.description)),
  },
  {
    id: 'ring-amulet',
    label: 'Ring and amulet recipes',
    section: 'rin',
    match:
      /^(?:(?:All |[FCLPM] )?Resi (?:Rare|Magic) (?:Ring|Amu):|(?:DR|LL|ML) (?:Rare|Magic) Ring:|\+\d+-\d+ Tree Magic (?:Amu|Rin) |(?:\w+ )?(?:Magic|Rare|Set|Unique) (?:Ring|Amulet): )/,
    collapse: byShape,
  },
  {
    id: 'jewel-recipes',
    label: 'Jewel recipes',
    section: 'jew',
    match: /^(?:Magic|Rare|Unique) Jewel(?: Reroll)?: /,
    collapse: byShape,
  },
  {
    id: 'quiver-recipes',
    label: 'Arrow and bolt quivers',
    section: 'qui',
    match: /^(?:Magic|Rare|Unique) (?:Arrow|Bolt)(?: Reroll)?(?::|$)/,
    collapse: byShape,
  },
  {
    id: 'materials',
    label: 'Organs, Decipherers, Steaks and Dragon Stones',
    section: 'mat',
    // ESR 3.3: a spare Orb of Anointment recycles into 2 Dragon Stones with a Key (3.2: into Maple Leaves)
    match:
      /^(?:Decipherer: |\d+ Decipherers: \d+ Steaks|\d+ (?:Brains|Eyes|Scalps|Horns|Fangs|Jawbones|Spleens|Quills|Tails|Flags): |Steak: |Cookbook: |DS: |Dstone Transformation x\d|Orb of Anointment Recycle to Dragon Stones$)/,
    collapse: byShape,
  },
  {
    id: 'gem-extras',
    label: 'Blemished gems and the Mi Rune',
    section: 'gem',
    match: /^(?:P-(?:Ame|Top|Sap|Eme|Rub|Dia|Sku|Obs)|Mi Rune \(r\d+\): .+)$/,
  },
  {
    id: 'quest-items',
    label: 'Quest items and the Cow Level portal',
    section: 'mis',
    match: /^(?:Horadric Staff|Khalim's Will|Cow Portal): /,
  },
  {
    id: 'potions',
    label: 'Potions, rejuvenations and elixirs',
    section: 'mis',
    // ESR 3.3 "Alchemist - Gem Infusion": a Perfect Gem and a Randomizing Stone into an elixir (Alchemist perks)
    match: /potion upgrade$|^(?:Full )?Rejuv Pot: |^\d+ Rejuv Pots: |^Alchemist - /,
    collapse: byShape,
  },
  {
    id: 'specializations',
    label: 'Mystical Tesseract (specialization points)',
    section: 'mis',
    match: /^Mystical Tesseract: /,
  },
  {
    id: 'repair',
    label: 'Repairing, recharging and replenishing',
    section: 'mis',
    match: /^(?:Repair|Recharge|Replenish)[ /]/,
    collapse: byShape,
  },
  {
    id: 'map-portals',
    label: 'Opening map portals',
    section: 'uber',
    match: /^(?:Tier \d+ Map [A-Z]|Unique Map - |Map Recycle |Rathma's Eternal Skull )/,
    collapse: (row) => (/^(?:Tier \d+ Map|Unique Map)/.test(row.description) ? 'portal' : descriptionShape(row.description)),
  },
  {
    id: 'dstoning',
    label: 'D-Stoning (Dragon Stone forms on any item) and summon damage',
    section: 'dst',
    match: /^(?:(?:VS|BM|DS|TO|SS|HS|CG|FH) \+ Any \w+|Forging Hammer \+ Antitode )/,
    rewrite: dstoneSlot,
    collapse: (row) => /^\w+ \+ Any (\w+)/.exec(row.description)?.[1] ?? descriptionShape(row.description),
    groupLabel: (rows) => {
      const slot = /^\w+ \+ Any (\w+)/.exec(rows[0]?.description ?? '')?.[1];
      return slot === undefined ? 'Summon damage (Forging Hammer + Antidote Potion)' : `D-Stoning ${DSTONE_SLOTS[slot] ?? slot}`;
    },
  },
  {
    id: 'tyrael-boon',
    label: "Tyrael's Might extra boon",
    section: 'tyrael',
    match: /^Tyrael Might Aura /,
  },
  {
    id: 'primordial-soulstone',
    label: 'Primordial Soulstones and ascendancy boss bonuses',
    section: 'ascendancy',
    match: /^(?:[\w ]+ Primordial Soulstone \d+|[\w ]+ Lich King Bonus|Stance Dance Fix)$/,
    collapse: (row) => (/Lich King|Stance Dance/.test(row.description) ? 'bonus' : 'soulstone'),
    outputBonus: 'hide',
  },
  // Small recipe sets without a family of their own until 3.3 (they were "Other recipes" under their cubemain names)
  {
    id: 'introductory-book',
    label: 'Introductory Book cycle',
    section: 'mis',
    match: /^Introductory Book Cycle \d+$/,
    groupLabel: () => 'Introductory Book, cubed alone',
  },
  {
    id: 'negative-charms',
    label: 'Small charms with negative Magic Find or maximum mana',
    section: 'cha',
    match: /^Negative MF Charm: /,
    groupLabel: () => 'Magic Small Charm + Ancient Decipherer + Stamina or Mana Potions',
  },
  {
    id: 'morph-charm-refund',
    label: 'Morph Charm refund',
    section: 'cha',
    match: /^Morph Charm Refund$/,
    groupLabel: () => 'Morph Charm, cubed alone',
  },
  {
    id: 'randomizing-stone',
    label: 'Randomizing Stone',
    section: 'mat',
    match: /^Randomize Stone$/,
    groupLabel: () => 'Chipped Skull + Key',
  },
  {
    id: 'ancients-gift',
    label: "Ancient's Gift: Unique Stones and Dragon Stones",
    section: 'mat',
    // cubemain names it "Anya's Gift"
    match: /^Anya's Gift\b/,
    groupLabel: () => "Ancient's Gift, cubed alone",
  },
  {
    id: 'can-opener',
    label: 'Can Opener size change',
    section: 'gem',
    match: /^Opener Size Change$/,
    groupLabel: () => 'Can Opener, cubed alone',
  },
  {
    id: 'weapons-crate',
    label: 'Weapons Crate',
    section: 'nor',
    match: /^Weapons Crate$/,
    groupLabel: () => 'Weapons Crate, cubed alone: a set of normal items',
  },
  {
    id: 'secret',
    label: 'Secret recipes',
    section: 'sec',
    // Not the ESR 3.3 "[SECRET08] Crucible - …" forgings (the crucible family)
    match: /^\[SECRET\d+\] (?!Crucible\b)/,
    collapse: (row) => secretNumber(row.description)?.toString() ?? row.description,
  },
];

const LEGACY_CRAFTS: Readonly<Partial<Record<string, string>>> = {
  hitpower: 'Hit Power',
  hit: 'Hit Power',
  blood: 'Blood',
  caster: 'Caster',
  safety: 'Safety',
};

/** The D-stoning group of a description's "+ Any <slot>" word */
const DSTONE_SLOTS: Readonly<Partial<Record<string, string>>> = {
  Weapon: 'weapons',
  Torso: 'body armor',
  Helm: 'helms',
  Shield: 'shields',
  Armor: 'gloves, belts and boots',
  Ring: 'rings',
  Amulet: 'amulets',
};

/**
 * The "Any Armor" D-stonings come after the body armor, helm and shield rows with the same reagents, which match those
 * first: they only apply to gloves, belts and boots (the official page's "Gloves/Belt/Boots").
 */
function dstoneSlot(recipe: RecipeVariant, row: CubeRow): RecipeVariant {
  if (parseCubeCell(row.inputs[0] ?? '').token !== 'armo') return recipe;
  return {
    inputs: recipe.inputs.map((input, i) => (i === 0 ? 'Gloves, Belt or Boots (the Any Armor rows)' : input)),
    output: recipe.output,
  };
}

/**
 * Cube page changes to guide families (the guide keeps its own): class crafts list each slot's bonuses, one group per
 * class (the guide merges them per class without the bonuses)
 */
export const CUBE_FAMILY_OVERRIDES: Readonly<Partial<Record<string, Partial<CubeFamily>>>> = {
  'class-craft': {
    rewrite: undefined,
    outputBonus: 'show',
    groupLabel: (rows) => {
      const first = rows.at(0);
      return `${first === undefined ? '' : craftClass(first)} craft`;
    },
  },
};

/** The family the cube page shows a guide family as (CUBE_FAMILY_OVERRIDES applied) */
export function cubePageFamily(family: CubeFamily): CubeFamily {
  const override = CUBE_FAMILY_OVERRIDES[family.id];
  return override === undefined ? family : { ...family, ...override };
}

/** Short notes per family (fail-safe limits and Gem Can points are added by bundleCube.ts from the rows) */
export const FAMILY_NOTES: Readonly<Partial<Record<string, readonly string[]>>> = {
  dstoning: [
    'The weapon Forging Hammer D-stoning (enhanced damage) has no cap row of its own; the 500% ceiling on enhanced damage and defense still applies.',
  ],
  'stocker-upgrades': ['Cube the stocker alone to cycle the selected rune or decal.'],
  'multi-stocker': ['Cube the Multi Stocker alone to cycle the selected item; storing and taking items out is left out.'],
  crucible: [
    'With the Blacksmith perk The Secret Crucible, a weapon or armor takes one more forging on top of its first: the same recipes and bonuses as the forging families above, removed the same way.',
  ],
  'rerolling-orb': [
    'The orb stores magic and rare rings, amulets, jewels, charms and quivers as points (one per item); cube it alone to pick which points it spends.',
  ],
};

/** `[SECRET07] …` → 7 */
export function secretNumber(description: string): number | null {
  const match = /^\[SECRET(\d+)\]/.exec(description);
  return match === null ? null : Number(match[1]);
}

/** Fallback family of a row no family matches: its description up to `:`, ` - ` or `(`, numbers as `#` */
export function fallbackPrefix(description: string): string {
  const cut = descriptionShape(description).split(/:| - |\(/)[0] ?? '';
  return cut.trim() === '' ? 'Unlabelled' : cut.trim();
}

export function fallbackFamilyId(prefix: string): string {
  return `other:${prefix
    .toLowerCase()
    .replace(/[^a-z0-9#]+/g, '-')
    .replace(/#/g, 'n')
    .replace(/^-|-$/g, '')}`;
}

/** A fallback family (grouped by description shape) */
export function fallbackFamily(prefix: string): ExtraFamily {
  return { id: fallbackFamilyId(prefix), label: prefix, section: 'other', match: /$^/, collapse: byShape };
}
