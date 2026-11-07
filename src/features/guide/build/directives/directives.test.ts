import { describe, expect, it } from 'vitest';
import type { GuideContext } from '../context.ts';
import { fixtureContext, fixtureEsr } from '../testContext.mock.ts';
import { formatInput } from '../../../game-data/build/cube/cubeText.ts';
import { isLeafDirective, LEAF_DIRECTIVES, resolveTerm } from './index.ts';
import { collectSecretRecipes } from './secretRecipes.ts';

function resolve(name: string, arg: string | null, ctx = fixtureContext(), attributes: Record<string, string> = {}) {
  if (!isLeafDirective(name)) throw new Error(`no resolver ${name}`);
  return LEAF_DIRECTIVES[name](arg, ctx, attributes);
}

describe('cube text', () => {
  it('formats quantities, qualities and notes', () => {
    const esr = fixtureEsr();
    expect(formatInput('gem5,qty=2', esr)).toBe('2× Perfect Gem');
    expect(formatInput('ring,mag,nos', esr)).toBe('Magic Ring (no sockets)');
    expect(formatInput('01a', esr)).toBe('Ancient Scroll 1');
    expect(formatInput('zzz', esr)).toBe('zzz');
  });
});

describe('secret recipes', () => {
  it('merges the variants of one recipe number and skips disabled rows', () => {
    const recipes = collectSecretRecipes(fixtureEsr());
    expect([...recipes.keys()]).toEqual([1, 2, 4, 5]);
    // Identical inputs with different outputs are one pool; the note is only the recipe number (no dev label)
    expect(recipes.get(1)).toEqual([
      {
        inputs: ['Crafted Ring', '2× Perfect Gem', 'Ancient Scroll 1'],
        output: 'Ring (Unique) / Unique item of the same type',
        note: '#1',
      },
    ]);
    expect(recipes.get(2)?.[0]?.output).toBe('An item of the same type (keeps its stats, 1 socket)');
  });

  it('shows the bonus of a recipe, without markers, unless it splits the recipe past the rows shown', () => {
    const recipes = collectSecretRecipes(fixtureEsr());
    expect(recipes.get(4)?.map((row) => row.output)).toEqual(['The same item (+25% to Experience Gained)', 'The same item']);
    // Four organs with four bonuses would be four rows: merged without the bonus instead
    expect(recipes.get(5)).toEqual([
      {
        inputs: ['Ring (no runeword)', '3× hrt / 3× sol / fng / … (4 variants)', '05a'],
        output: 'The same item',
        note: '#5 (+3 variants)',
      },
    ]);
  });

  it('resolves all recipes and a single recipe', () => {
    const all = resolve('secret-recipes', null);
    expect('kind' in all && all.kind === 'recipes' && all.rows).toHaveLength(5);
    const one = resolve('secret-recipe', '2');
    expect(one).toMatchObject({
      kind: 'recipes',
      caption: 'Secret recipe 2 (the Ancient Scroll is returned)',
      rows: [{ inputs: ['Magic Ring (no sockets)', 'Jewel'] }],
    });
  });

  it('reports bad arguments, unknown numbers and a missing clone', () => {
    expect(resolve('secret-recipe', null)).toHaveProperty('error');
    expect(resolve('secret-recipe', '99')).toEqual({ error: '::secret-recipe[99]: no [SECRET99] rows in cubemain.txt' });
    expect(resolve('secret-recipes', 'x')).toHaveProperty('error');
    expect(resolve('secret-recipes', null, fixtureContext({ esr: null }))).toEqual({
      error: '::secret-recipes needs the ESR clone (not found; pass --esr <dir>)',
    });
  });
});

describe('recipe-output', () => {
  it('lists the distinct outputs of the rows with that description', () => {
    expect(resolve('recipe-output', "Adventurer's Pack")).toEqual({
      kind: 'items',
      caption: "Adventurer's Pack contains",
      items: [
        { label: "Noob's Odd Charm", detail: 'Normal, 1 socket' },
        { label: 'Kill Ledger', detail: null },
      ],
    });
    expect(resolve('recipe-output', 'Nope')).toHaveProperty('error');
  });
});

describe('vendor', () => {
  it('lists what an NPC sells from misc, armor and weapons (case-insensitive NPC name)', () => {
    expect(resolve('vendor', 'gheed')).toEqual({
      kind: 'items',
      caption: 'Sold by Gheed',
      items: [
        { label: 'Jewel', detail: 'magic only' },
        { label: 'Rerolling Orb', detail: null },
        { label: 'Skull Cap', detail: null },
      ],
    });
    expect(resolve('vendor', 'Charsi')).toMatchObject({ items: [{ label: 'Crystal Sword' }] });
  });

  it('rejects unknown NPCs (TMog is not a vendor)', () => {
    expect(resolve('vendor', 'TMog')).toHaveProperty('error');
    expect(resolve('vendor', null)).toHaveProperty('error');
  });
});

describe('dstone-caps', () => {
  const step = (lines: string[], capLines?: string[]) => ({ lines, levelReq: 2, steps: [5], ...(capLines ? { cap: 1, capLines } : {}) });
  const ctx = (): GuideContext => ({
    ...fixtureContext(),
    crafting: {
      stacking: [
        {
          kind: 'dstone',
          material: { code: 'ppp', label: 'Dragon Stone' },
          bySlot: {
            weapon: step(['+5% IAS'], ['+121% IAS']),
            ...Object.fromEntries(
              ['shield', 'helmet', 'armor', 'gloves', 'boots', 'belt'].map((slot) => [slot, step(['+5% IAS'], ['+120% IAS'])])
            ),
            amulet: step(['+5% IAS'], ['+120% IAS']),
            ring: step(['+3% DS'], ['+102% DS']),
          },
        },
        {
          kind: 'dstone',
          material: { code: 'hh2', label: 'Forging Hammer' },
          switchItem: { code: 'key', label: 'Key' },
          bySlot: { weapon: step(['+12% ED']) },
        },
        { kind: 'meld', material: { code: 'ggb', label: 'Perfect Emerald' }, bySlot: { helmet: { lines: ['+5 Dex'], levelReq: 3 } } },
      ],
    },
  });

  it('lists one row per ingredients and cap, the slots with that cap joined, melds left out', () => {
    expect(resolve('dstone-caps', null, ctx())).toEqual({
      kind: 'table',
      caption: 'D-stoning caps (what D-stoning adds at most)',
      header: ['Ingredients', 'Item', 'Cap'],
      rows: [
        ['Dragon Stone', 'Weapon', '+121% IAS'],
        ['Dragon Stone', 'Any armor, Amulet', '+120% IAS'],
        ['Dragon Stone', 'Ring', '+102% DS'],
        ['Forging Hammer + Key', 'Weapon', '+12% ED per use, no cap'],
      ],
    });
    // Only some armour slots: listed one by one
    const some: GuideContext = {
      ...fixtureContext(),
      crafting: {
        stacking: [
          {
            kind: 'dstone',
            material: { code: 'ppp', label: 'Dragon Stone' },
            bySlot: { shield: step(['x'], ['y']), belt: step(['x'], ['y']) },
          },
        ],
      },
    };
    expect(resolve('dstone-caps', null, some)).toMatchObject({ rows: [['Dragon Stone', 'Shield, Belt', 'y']] });
  });

  it('needs crafting.json and takes no argument', () => {
    expect(resolve('dstone-caps', null, { ...fixtureContext(), crafting: null })).toHaveProperty('error');
    expect(resolve('dstone-caps', 'weapon', ctx())).toHaveProperty('error');
  });
});

describe('difficulty-penalties', () => {
  it('builds a table from difficultylevels.txt, one row per penalty and one column per difficulty', () => {
    expect(resolve('difficulty-penalties', null)).toEqual({
      kind: 'table',
      caption: 'Penalties per difficulty',
      header: ['Penalty', 'Normal', 'Nightmare', 'Hell'],
      rows: [
        ['Resistance penalty', '0', '-40', '-100'],
        ['Experience lost on death', '0%', '5%', '10%'],
        ['Monster skill bonus', '+0', '+3', '+7'],
        ['Life leech divided by', '1', '25', '150'],
        ['Mana leech divided by', '1', '15', '75'],
        ["Your and your summons' damage to prime evils", '100%', '50%', '25%'],
        ['Mercenary damage to bosses', '50%', '35%', '25%'],
        ['Freeze length on monsters divided by', '1', '2', '4'],
        ['Chill length on monsters divided by', '1', '2', '4'],
        ['Terror, Confuse, Attract and Dim Vision length on monsters divided by', '1', '2', '4'],
      ],
    });
  });
});

describe('source', () => {
  it('returns the labels from sources.json, matching names case-insensitively', () => {
    expect(resolve('source', 'annihilus')).toEqual({
      kind: 'source',
      item: 'Annihilus',
      labels: [{ kind: 'boss', text: 'Drops from Diablo Clone' }],
    });
    expect(resolve('source', 'Nope')).toEqual({ error: '::source[Nope]: no item with that name in sources.json' });
  });

  it('requires {item=…} when a name exists for several item kinds', () => {
    expect(resolve('source', 'Worldstone Shard')).toEqual({
      error: '::source[Worldstone Shard]: ambiguous (2 items: set, misc); add {item=…}, e.g. ::source[Worldstone Shard]{item=set}',
    });
    expect(resolve('source', 'Worldstone Shard', fixtureContext(), { item: 'misc' })).toEqual({
      kind: 'source',
      item: 'Worldstone Shard',
      labels: [{ kind: 'boss', text: 'Drops from Baal' }],
    });
    expect(resolve('source', 'Annihilus', fixtureContext(), { item: 'set' })).toEqual({
      error: '::source[Annihilus]: no item with that name and item=set in sources.json',
    });
    expect(resolve('source', 'Annihilus', fixtureContext(), { item: 'rune' })).toHaveProperty('error');
    expect(resolve('source', 'Annihilus', fixtureContext(), { kind: 'unique' })).toHaveProperty('error');
  });

  it('works without the ESR clone', () => {
    expect(resolve('source', 'Annihilus', fixtureContext({ esr: null }))).toHaveProperty('kind', 'source');
  });
});

describe('glossary and term', () => {
  it('lists the glossary sorted by term', () => {
    expect(resolve('glossary', null)).toMatchObject({ kind: 'glossary', entries: [{ term: 'Cube' }, { term: 'Stocker' }] });
  });

  it('resolves terms case-insensitively and keeps the label', () => {
    const ctx = fixtureContext();
    expect(resolveTerm('stocker', 'stockers', ctx)).toEqual({
      type: 'term',
      term: 'Stocker',
      children: [{ type: 'text', value: 'stockers' }],
    });
    expect(resolveTerm('Cube', null, ctx)).toEqual({ type: 'term', term: 'Cube', children: [{ type: 'text', value: 'Cube' }] });
    expect(resolveTerm('Nope', null, ctx)).toHaveProperty('error');
  });
});

describe('card', () => {
  it('embeds a card with the name as written and the app link of the same scheme', () => {
    expect(resolve('card', 'rw:Enigma')).toEqual({ kind: 'card', item: 'runeword', name: 'Enigma', href: '/runewords?name=Enigma' });
    expect(resolve('card', "unique:Artemis' Wrath")).toEqual({
      kind: 'card',
      item: 'unique',
      name: "Artemis' Wrath",
      href: "/uniques?name=Artemis'%20Wrath",
    });
    expect(resolve('card', 'mythical:frostmourne')).toEqual({
      kind: 'card',
      item: 'mythical',
      name: 'frostmourne',
      href: '/mythicals?name=frostmourne',
    });
    expect(resolve('card', 'socketable:El Rune')).toMatchObject({ item: 'socketable', href: '/socketables?name=El%20Rune' });
    // Gemwords are not validated (no bundle has their names)
    expect(resolve('card', 'gw: Any Gemword ')).toEqual({
      kind: 'card',
      item: 'gemword',
      name: 'Any Gemword',
      href: '/gemwords?name=Any%20Gemword',
    });
    expect(resolve('card', 'rw:100%')).toHaveProperty('error', '::card[rw:100%]: unknown runeword "100%" (rw:)');
  });

  it('rejects unknown names, schemes, a missing name and attributes', () => {
    expect(resolve('card', 'rw:Nope')).toEqual({ error: '::card[rw:Nope]: unknown runeword "Nope" (rw:)' });
    expect(resolve('card', 'unique:El Rune')).toHaveProperty('error');
    expect(resolve('card', 'base:crs')).toHaveProperty('error');
    expect(resolve('card', 'Enigma')).toHaveProperty('error');
    expect(resolve('card', 'rw:')).toHaveProperty('error');
    expect(resolve('card', null)).toHaveProperty('error');
    expect(resolve('card', 'rw:Enigma', fixtureContext(), { size: 'big' })).toHaveProperty('error');
  });
});
